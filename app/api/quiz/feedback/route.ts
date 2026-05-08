import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { diagnose } from "@/lib/diagnosis";
import { buildFeedbackUserPrompt, FEEDBACK_SYSTEM_PROMPT } from "@/lib/feedback-prompt";
import { GradingError, gradeRound } from "@/lib/grading";
import { getQuestionMap } from "@/lib/questions";
import { QuizSubmitRequest } from "@/lib/quiz-submit.schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Reused across requests on the same warm Node process; the SDK reads
// ANTHROPIC_API_KEY lazily on first call.
const anthropic = new Anthropic();

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = QuizSubmitRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const lookup = getQuestionMap();
  let graded: ReturnType<typeof gradeRound>;
  try {
    graded = gradeRound(parsed.data, (id) => lookup.get(id));
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
  const userPrompt = buildFeedbackUserPrompt({ diagnosis, graded });

  // Stream Claude Haiku 4.5 output as plain text. The client reads byte chunks
  // off the response body and appends them to the UI as they arrive.
  const sdkStream = anthropic.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: FEEDBACK_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of sdkStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
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
