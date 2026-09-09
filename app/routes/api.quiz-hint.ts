import { GradingError, gradeRound } from "@/lib/grading";
import { HintRequest, type HintResponse } from "@/lib/hint.schema";
import { nudgeThresholdMs } from "@/lib/hint-policy";
import { getQuestionMap } from "@/lib/questions.server";
import { checkRateLimit } from "@/lib/rate-limit.server";
import type { Route } from "./+types/api.quiz-hint";

export function loader() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

export async function action({ request }: Route.ActionArgs) {
  // LLM 호출도 DB write도 없는 map 조회라 /feedback처럼 조일 이유가 없다.
  // 라운드당 최대 10회(문항당 1회)라 정상 사용자는 근처에도 안 온다.
  const limited = await checkRateLimit(request, {
    prefix: "hint",
    tokens: 60,
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

  const parsed = HintRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { question_ids, answers, index } = parsed.data;

  const lookup = getQuestionMap();
  let graded: Awaited<ReturnType<typeof gradeRound>>;
  try {
    graded = await gradeRound({ question_ids, answers }, (id) =>
      lookup.get(id),
    );
  } catch (err) {
    if (err instanceof GradingError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // gradeRound가 통과했으면 모든 id가 풀에 있다.
  const current = lookup.get(question_ids[index]);
  if (!current) {
    return Response.json({ error: "unknown question" }, { status: 400 });
  }

  // 채점 결과는 여기서 신호로만 소비되고 응답으로는 한 글자도 나가지 않는다.
  // 현재 문항은 빼고 센다 — 지금 풀고 있는 문항의 정답 여부로 힌트 타이밍을
  // 정하면 그게 곧 "지금 고른 게 틀렸다"는 통보다.
  let answered = 0;
  let correct = 0;
  let categoryWrong = 0;
  graded.per_question.forEach((row, i) => {
    if (i === index || answers[i] === null) {
      return;
    }
    answered += 1;
    if (row.is_correct) {
      correct += 1;
    } else if (row.category === current.category) {
      categoryWrong += 1;
    }
  });

  // 힌트가 없는 문항에서 뱃지를 띄우면 눌렀을 때 빈손이다. 조용히 있는다.
  const nudge_at_ms =
    current.hint === undefined
      ? null
      : nudgeThresholdMs({
          changeCount: parsed.data.change_count,
          isRevisit: parsed.data.is_revisit,
          difficulty: current.difficulty,
          answered,
          correct,
          categoryWrong,
        });

  const response: HintResponse = {
    nudge_at_ms,
    hint: current.hint ?? null,
    ...(current.hint_html === undefined
      ? {}
      : { hint_html: current.hint_html }),
  };

  return Response.json(response, {
    headers: { "cache-control": "no-store" },
  });
}
