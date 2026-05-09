import { NextResponse } from "next/server";
import { diagnose } from "@/lib/diagnosis";
import { GradingError, gradeRound } from "@/lib/grading";
import { getQuestionMap } from "@/lib/questions";
import { QuizSubmitRequest, type QuizSubmitResponse } from "@/lib/quiz-submit.schema";
import { checkRateLimit } from "@/lib/rate-limit";

// gradeRound({ withHtml: true }) → Shiki(WASM) 하이라이팅. WASM은 Edge runtime
// 호환이 케이스에 따라 깨지므로 안전하게 nodejs로 고정. /api/share, /feedback과
// 일관성 있게.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  // Submit은 DB write도 외부 API도 없어 cheap하지만, /api/share + /feedback과
  // 결합한 봇 시나리오 막기 위해 느슨하게 제한. 정상 사용자는 분당 30 미만.
  const limited = await checkRateLimit(request, { prefix: "submit", tokens: 30, windowSec: 60 });
  if (limited) return limited;

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
    graded = await gradeRound(parsed.data, (id) => lookup.get(id), { withHtml: true });
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
