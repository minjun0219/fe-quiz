import { waitUntil } from "cloudflare:workers";
import { diagnose } from "@/lib/diagnosis";
import { GradingError, gradeRound } from "@/lib/grading";
import { logger } from "@/lib/logger.server";
import { flushPostHogServer } from "@/lib/posthog-server.server";
import { getQuestionMap } from "@/lib/questions.server";
import { checkRateLimit } from "@/lib/rate-limit.server";
import {
  ShareCreateRequest,
  type ShareCreateResponse,
} from "@/lib/share.schema";
import { createShare } from "@/lib/share-store.server";
import type { Route } from "./+types/api.share";

const ALLOWED_PROTOS = new Set(["http", "https"]);

/** wrangler.jsonc env별 vars로 주입되는 이 배포의 canonical origin. */
function canonicalSiteUrl(): string | null {
  return process.env.SITE_URL ?? null;
}

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

// Host(또는 X-Forwarded-Host) 화이트리스트 — 프록시가 client-supplied 헤더를
// 그대로 통과시키는 경우 진짜 slug가 박힌 가짜 도메인 링크가 만들어질 수
// 있어 알려진 호스트만 허용한다.
function isAllowedHost(host: string): boolean {
  // 포트 분리. IPv6는 [::1]:3000 형태라 마지막 ':' 기준만 자르면 됨.
  const hostname = host.replace(/:\d+$/, "");
  const canonical = canonicalSiteUrl();
  if (canonical) {
    try {
      if (hostname === new URL(canonical).hostname) {
        return true;
      }
    } catch {
      // malformed SITE_URL — 아래 일반 규칙으로 폴백
    }
  }
  if (hostname.endsWith(".workers.dev")) {
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
//  1) Host/프록시 헤더가 화이트리스트 통과 → 그 호스트로 빌드
//  2) 통과 실패(헤더 누락/스푸핑 의심) → env의 SITE_URL로 떨어뜨려
//     가짜 도메인 share URL 차단
//  3) 안전망: localhost
function siteUrl(request: Request): string {
  const host = firstHeaderValue(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  );
  if (!host || !isAllowedHost(host)) {
    return canonicalSiteUrl() ?? "http://localhost:3000";
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

export function loader() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

export async function action({ request }: Route.ActionArgs) {
  // 응답 후 PostHog 펜딩 이벤트 flush — invocation이 죽기 전 보장된 송신 경로.
  // flushPostHogServer가 실패를 삼키므로 waitUntil에서 unhandled rejection
  // 노이즈 없음.
  waitUntil(flushPostHogServer());

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
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = ShareCreateRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
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
      return Response.json({ error: err.message }, { status: 400 });
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
    return Response.json({ error: "failed to create share" }, { status: 500 });
  }

  // `new URL(...)` normalizes trailing slashes etc. so a SITE_URL of
  // "https://x.com/" doesn't yield "https://x.com//r/abc".
  const response: ShareCreateResponse = {
    slug,
    url: new URL(`/r/${slug}`, siteUrl(request)).toString(),
  };
  return Response.json(response);
}
