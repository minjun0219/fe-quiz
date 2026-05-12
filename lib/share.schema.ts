import { z } from "zod";
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
