import { z } from "zod";
import { NICKNAME_MAX_LENGTH } from "./nickname";
import { Category } from "./question.schema";
import { SubmittedAnswer } from "./quiz-submit.schema";

/**
 * Body of POST /api/share.
 *
 * Server re-grades from `question_ids` + `answers` rather than trusting any
 * client-side score: the only client-supplied content we accept verbatim is
 * the `feedback` text the user just saw streamed back from /api/quiz/feedback,
 * which is non-authoritative anyway.
 */
export const ShareCreateRequest = z
  .object({
    question_ids: z.array(z.string().min(1)).min(1).max(20),
    answers: z.array(SubmittedAnswer).min(1).max(20),
    feedback: z.string().min(1).max(2000),
    // 점수판 표시용. 신원 증명이 아니라 "친구끼리 알아보기"용이라 사칭을
    // 막지 않는다(인증이 없어 막을 방법도 없다). 여기서는 상한만 보고,
    // 제어문자·공백 정리는 `normalizeNickname`이 저장 직전에 한다.
    nickname: z.string().max(NICKNAME_MAX_LENGTH).optional(),
  })
  .superRefine((req, ctx) => {
    if (req.answers.length !== req.question_ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["answers"],
        message: `answers.length (${req.answers.length}) must equal question_ids.length (${req.question_ids.length})`,
      });
    }
    // Match QuizSubmitRequest: forbid duplicate question_ids — duplicates
    // skew grading and replay (same question would repeat in the friend's
    // round).
    const seen = new Set<string>();
    req.question_ids.forEach((id, i) => {
      if (seen.has(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["question_ids", i],
          message: `duplicate question_id "${id}"`,
        });
      }
      seen.add(id);
    });
  });

export type ShareCreateRequest = z.infer<typeof ShareCreateRequest>;

export interface ShareCreateResponse {
  slug: string;
  url: string;
}

/**
 * Runtime validator for a row pulled from `shares`. RLS allows anonymous
 * INSERT, so any read of the table must defend against malformed JSON in
 * `category_scores`. Use `safeParse` and treat parse failures as "row not
 * found" rather than rendering NaNs.
 */
export const ShareRowSchema = z.object({
  id: z.string().min(1),
  question_ids: z.array(z.string().min(1)).min(1).max(20),
  score: z.number().int().min(0).max(100),
  feedback: z.string(),
  result_type: z.string(),
  // 마이그레이션 0003으로 추가된 컬럼. 이전 row는 NULL — 화면에서 "익명".
  //
  // optional까지 허용하는 이유: 코드 배포와 마이그레이션 적용은 별도
  // 워크플로라 "새 코드 + 옛 스키마"인 순간이 존재한다. 그때 `SELECT *`에는
  // 이 키가 아예 없는데, 스키마 실패는 `getShareById`에서 "없는 결과"(404)로
  // 처리되므로 필수로 두면 그 창 동안 모든 공유 링크가 죽는다.
  nickname: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  // Sparse by design: a round only includes a subset of categories, so the
  // stored row carries only the categories that actually appeared. Zod 4's
  // `z.record(z.enum, …)` is exhaustive — adding a new category to
  // `CATEGORIES` would otherwise retroactively invalidate every existing
  // share row (safeParse → null → 404). `z.partialRecord` skips that check.
  category_scores: z.partialRecord(
    Category,
    z.object({
      correct: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
  ),
  created_at: z.string(),
});

export type ShareRow = z.infer<typeof ShareRowSchema>;
