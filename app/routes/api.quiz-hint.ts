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

  const current = getQuestionMap().get(parsed.data.question_id);
  if (!current) {
    return Response.json({ error: "unknown question" }, { status: 400 });
  }

  // 임계값은 요청자가 스스로 계산할 수 있는 값으로만 정한다 — 난이도는
  // 라운드 페이로드에 이미 있고 번복·재방문은 클라이언트가 보낸 것이다.
  // 서버만 아는 성적을 섞으면 이 숫자가 곧 앞 문항의 채점 결과가 된다.
  //
  // 힌트가 없는 문항에서 뱃지를 띄우면 눌렀을 때 빈손이다. 조용히 있는다.
  const nudge_at_ms =
    current.hint === undefined
      ? null
      : nudgeThresholdMs({
          changeCount: parsed.data.change_count,
          isRevisit: parsed.data.is_revisit,
          difficulty: current.difficulty,
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
