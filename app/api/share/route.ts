import { NextResponse } from "next/server";
import { diagnose } from "@/lib/diagnosis";
import { GradingError, gradeRound } from "@/lib/grading";
import { logger } from "@/lib/logger";
import { getQuestionMap } from "@/lib/questions";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  ShareCreateRequest,
  type ShareCreateResponse,
} from "@/lib/share.schema";
import { createShare } from "@/lib/share-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel이 모든 배포의 빌드/런타임 env에 자동으로 채워주는 운영 도메인.
// 코드에 도메인을 박을 필요 없이 프로젝트 설정만으로 운영 URL이 따라옴.
const PROD_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL;

const ALLOWED_PROTOS = new Set(["http", "https"]);

// 프록시 체인이 길어지면 X-Forwarded-* 헤더는 "a.com, b.com"처럼 콤마로
// 누적될 수 있다. 첫 번째 값만 trim해서 쓴다.
function firstHeaderValue(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  const first = raw.split(",")[0]?.trim();
  return first || null;
}

function isLoopbackHost(host: string): boolean {
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]") ||
    host.startsWith("0.0.0.0")
  );
}

// Host(또는 X-Forwarded-Host) 화이트리스트 — Codex 지적처럼 프록시가
// client-supplied 헤더를 그대로 통과시키는 경우 진짜 slug가 박힌 가짜
// 도메인 링크가 만들어질 수 있어 알려진 호스트만 허용한다.
function isAllowedHost(host: string): boolean {
  // 포트 분리. IPv6는 [::1]:3000 형태라 마지막 ':' 기준만 자르면 됨.
  const hostname = host.replace(/:\d+$/, "");
  if (PROD_HOST && hostname === PROD_HOST) {
    return true;
  }
  if (hostname.endsWith(".vercel.app")) {
    return true;
  }
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "0.0.0.0"
  ) {
    return true;
  }
  return false;
}

// 우선순위:
//  1) 프록시 헤더가 화이트리스트 통과 → 그 호스트로 빌드
//  2) 통과 실패(헤더 누락/스푸핑 의심) AND Vercel이면 운영 도메인으로
//     떨어뜨려 가짜 도메인 share URL 차단
//  3) 비-Vercel(로컬 dev 등): 화이트리스트가 host=localhost를 이미 잡으니
//     실제로 (2)·(3) 분기가 꼬일 일이 없음. 안전망으로 localhost.
function siteUrl(request: Request): string {
  const host = firstHeaderValue(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  );
  if (!host || !isAllowedHost(host)) {
    return PROD_HOST ? `https://${PROD_HOST}` : "http://localhost:3000";
  }
  const forwardedProto = firstHeaderValue(
    request.headers.get("x-forwarded-proto"),
  );
  const proto =
    forwardedProto && ALLOWED_PROTOS.has(forwardedProto)
      ? forwardedProto
      : isLoopbackHost(host)
        ? "http"
        : "https";
  return `${proto}://${host}`;
}

export async function POST(request: Request): Promise<Response> {
  // Share INSERT는 DB row 폭증 + 가짜 슬러그 양산 위험. 분당 10개 이상은
  // 정상 사용자 흐름이 아님 (한 라운드 풀이 + 공유에 분 단위가 걸림).
  const limited = await checkRateLimit(request, {
    prefix: "share",
    tokens: 10,
    windowSec: 60,
  });
  if (limited) {
    return limited;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = ShareCreateRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Server re-grades from question_ids + answers — never trust a client-supplied score.
  const lookup = getQuestionMap();
  let graded: Awaited<ReturnType<typeof gradeRound>>;
  try {
    graded = await gradeRound(
      { question_ids: parsed.data.question_ids, answers: parsed.data.answers },
      (id) => lookup.get(id),
    );
  } catch (err) {
    if (err instanceof GradingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const diagnosis = diagnose({
    total_correct: graded.total_correct,
    total: graded.total,
    category_scores: graded.category_scores,
  });

  let slug: string;
  try {
    slug = await createShare({
      graded,
      result_type: diagnosis.result_type,
      feedback: parsed.data.feedback,
    });
  } catch (err) {
    // Log full detail server-side; never echo DB / internal messages to the
    // client — they can leak schema info or auth state.
    logger.error({ err }, "[/api/share] createShare failed");
    return NextResponse.json(
      { error: "failed to create share" },
      { status: 500 },
    );
  }

  // `new URL(...)` normalizes trailing slashes etc. so a SITE_URL of
  // "https://x.com/" doesn't yield "https://x.com//r/abc".
  const response: ShareCreateResponse = {
    slug,
    url: new URL(`/r/${slug}`, siteUrl(request)).toString(),
  };
  return NextResponse.json(response);
}
