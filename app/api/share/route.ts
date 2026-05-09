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

// 1순위: 명시적 env override.
// 2순위: 프록시 헤더(Vercel은 x-forwarded-* 세팅) → 커스텀 도메인/프리뷰/로컬
//        모두 자동으로 맞는 값을 만들어줘서 NEXT_PUBLIC_SITE_URL 미설정 시
//        share URL이 localhost:3000으로 새지 않는다.
function siteUrl(request: Request): string {
  const override = process.env.NEXT_PUBLIC_SITE_URL;
  if (override) {
    return override;
  }
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    return "http://localhost:3000";
  }
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
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
