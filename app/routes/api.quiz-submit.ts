import { waitUntil } from "cloudflare:workers";
import { diagnose } from "@/lib/diagnosis";
import { GradingError, gradeRound } from "@/lib/grading";
import { flushPostHogServer } from "@/lib/posthog-server.server";
import { getQuestionMap } from "@/lib/questions.server";
import {
  QuizSubmitRequest,
  type QuizSubmitResponse,
} from "@/lib/quiz-submit.schema";
import { checkRateLimit } from "@/lib/rate-limit.server";
import type { Route } from "./+types/api.quiz-submit";

export function loader() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

export async function action({ request }: Route.ActionArgs) {
  // 응답 후 PostHog 펜딩 이벤트 flush — invocation이 죽기 전 보장된 송신 경로.
  waitUntil(flushPostHogServer());

  // Submit은 DB write도 외부 API도 없어 cheap하지만, /api/share + /feedback과
  // 결합한 봇 시나리오 막기 위해 느슨하게 제한. 정상 사용자는 분당 30 미만.
  const limited = await checkRateLimit(request, {
    prefix: "submit",
    tokens: 30,
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

  const parsed = QuizSubmitRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "invalid request",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const lookup = getQuestionMap();

  let graded: Awaited<ReturnType<typeof gradeRound>>;
  try {
    graded = await gradeRound(parsed.data, (id) => lookup.get(id), {
      withHtml: true,
    });
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

  const response: QuizSubmitResponse = { ...graded, ...diagnosis };
  return Response.json(response);
}
