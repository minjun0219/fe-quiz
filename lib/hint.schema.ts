import { z } from "zod";

/**
 * Body of POST /api/quiz/hint.
 *
 * 문항 하나와 그 문항에서의 행동 신호만 받는다. 처음 설계는 `/api/quiz/submit`처럼
 * `question_ids` + `answers`를 통째로 받아 재채점하고 그 성적으로 임계값을
 * 당기고 늦췄는데, 임계값이 숫자로 내려가는 구조에서는 그게 정답 오라클이
 * 됐다 — 앞 문항에 후보 답을 넣고 뒷 문항의 임계값을 읽으면 앞 문항의 정오가
 * 보인다. 그래서 답변은 아예 받지 않는다. 서버가 이 요청으로 알게 되는 건
 * 요청자가 이미 아는 것뿐이다.
 *
 * 체류 시간도 보내지 않는다. 서버는 "얼마나 기다렸다 알릴 것인가"만 정하고
 * 카운트다운은 클라이언트가 한다 — 문항당 요청 한 번으로 끝내려는 것이다.
 */
export const HintRequest = z.object({
  /** 힌트를 요청하는 문항. */
  question_id: z.string().min(1),
  change_count: z.number().int().min(0).max(500),
  is_revisit: z.boolean(),
});

export type HintRequest = z.infer<typeof HintRequest>;

/**
 * 채점 결과는 어떤 형태로도 나가지 않는다 (ADR 0005) — 애초에 이 라우트는
 * 답변을 받지 않으니 채점할 것도 없다.
 *
 * 힌트는 뱃지가 뜨기 전에도 실려 나간다 — 탭은 항상 열려 있어서(뱃지는 접근
 * 권한이 아니라 알림이다) 눌렀을 때 또 왕복하지 않으려는 것이다.
 */
export interface HintResponse {
  /**
   * 이 문항에 이만큼 머무르면 캐릭터가 뱃지로 알린다(ms). 카운트다운은
   * 클라이언트가 한다. 힌트가 없는 문항이면 null — 알릴 게 없다.
   */
  nudge_at_ms: number | null;
  /** 이 문항의 힌트. 아직 안 쓰인 문항이면 null. */
  hint: string | null;
  /** 빌드 타임에 렌더된 HTML. 없으면 클라이언트가 `hint` 원문으로 폴백. */
  hint_html?: string;
}
