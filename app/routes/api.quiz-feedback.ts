import { waitUntil } from "cloudflare:workers";
import Anthropic from "@anthropic-ai/sdk";
import { diagnose } from "@/lib/diagnosis";
import {
  buildFeedbackUserPrompt,
  FEEDBACK_SYSTEM_PROMPT,
} from "@/lib/feedback-prompt";
import { GradingError, gradeRound } from "@/lib/grading";
import { flushPostHogServer } from "@/lib/posthog-server.server";
import { getQuestionMap } from "@/lib/questions.server";
import { QuizSubmitRequest } from "@/lib/quiz-submit.schema";
import { checkRateLimit } from "@/lib/rate-limit.server";
import type { Route } from "./+types/api.quiz-feedback";

// warm isolate 동안 재사용. 모듈 초기화 시점엔 env 주입이 보장되지 않으므로
// (secrets는 요청 컨텍스트에서 안전) 첫 요청에서 lazy 생성한다.
let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  anthropic ??= new Anthropic();
  return anthropic;
}

export function loader() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

export async function action({ request }: Route.ActionArgs) {
  waitUntil(flushPostHogServer());

  // 피드백은 Anthropic 호출당 비용 직결 (Haiku 4.5, ~$0.003/req). 분당 5개로
  // 가장 타이트하게 가둠. 정상 사용자가 같은 라운드 결과를 분당 5번 이상 새로
  // 띄울 일은 없음 (한 라운드 한 번 streaming).
  const limited = await checkRateLimit(request, {
    prefix: "feedback",
    tokens: 5,
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
      { error: "invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 },
    );
  }

  const lookup = getQuestionMap();
  let graded: Awaited<ReturnType<typeof gradeRound>>;
  try {
    graded = await gradeRound(parsed.data, (id) => lookup.get(id));
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
  const userPrompt = buildFeedbackUserPrompt({
    diagnosis,
    graded,
    level: parsed.data.level,
  });

  // Stream Claude Haiku 4.5 output as plain text. The client reads byte chunks
  // off the response body and appends them to the UI as they arrive.
  const sdkStream = getAnthropic().messages.stream({
    model: "claude-haiku-4-5",
    // 4-6 Korean sentences across 2 단락 typically run 250-500 tokens;
    // 1024 is a safety cap so a misbehaving generation can't blow up latency
    // or cost. Stays comfortably under the 2000-char share-feedback cap.
    max_tokens: 1024,
    system: FEEDBACK_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of sdkStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      sdkStream.controller.abort();
    },
  });

  return new Response(responseStream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
