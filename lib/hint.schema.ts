import { z } from "zod";
import { SubmittedAnswer } from "./quiz-submit.schema";

/**
 * Body of POST /api/quiz/hint.
 *
 * `question_ids` + `answers`를 통째로 받는 건 `/api/quiz/submit`과 같은 이유다
 * — 서버가 라운드 상태를 들고 있지 않다. 힌트 판정에 "지금까지 몇 개 맞혔나"가
 * 필요한데, 그걸 저장소에 쌓는 대신 요청마다 다시 채점한다. 익명 세션 ID도
 * 마이그레이션도 필요 없고, "결과 공유 시에만 데이터 저장" 원칙도 그대로다.
 *
 * 체류 시간은 보내지 않는다. 서버는 "얼마나 기다렸다 알릴 것인가"만 정하고
 * 카운트다운은 클라이언트가 한다 — 문항당 요청 한 번으로 끝내려는 것이다.
 * 체류를 서버가 판정하면, 값을 바꿔 가며 재요청해 임계값을 읽어낼 수 있고
 * 임계값은 곧 앞 문항의 정답 여부가 된다.
 */
export const HintRequest = z
  .object({
    question_ids: z.array(z.string().min(1)).min(1).max(20),
    answers: z.array(SubmittedAnswer).min(1).max(20),
    /** 힌트를 요청하는 문항의 인덱스. */
    index: z.number().int().min(0).max(19),
    change_count: z.number().int().min(0).max(500),
    is_revisit: z.boolean(),
  })
  .superRefine((req, ctx) => {
    if (req.answers.length !== req.question_ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["answers"],
        message: `answers.length (${req.answers.length}) must equal question_ids.length (${req.question_ids.length})`,
      });
    }
    if (req.index >= req.question_ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["index"],
        message: `index (${req.index}) is out of range for ${req.question_ids.length} questions`,
      });
    }
  });

export type HintRequest = z.infer<typeof HintRequest>;

/**
 * 채점 결과는 어떤 형태로도 나가지 않는다 (ADR 0005).
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
