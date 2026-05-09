import { NextResponse } from "next/server";
import { diagnose } from "@/lib/diagnosis";
import { GradingError, gradeRound } from "@/lib/grading";
import { getQuestionMap } from "@/lib/questions";
import { QuizSubmitRequest, type QuizSubmitResponse } from "@/lib/quiz-submit.schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = QuizSubmitRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
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
    graded = await gradeRound(parsed.data, (id) => lookup.get(id));
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

  const response: QuizSubmitResponse = { ...graded, ...diagnosis };
  return NextResponse.json(response);
}
