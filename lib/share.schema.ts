import { z } from "zod";
import type { Category } from "./question.schema";

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
    answers: z.array(z.number().int().nonnegative().nullable()).min(1).max(20),
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
  });

export type ShareCreateRequest = z.infer<typeof ShareCreateRequest>;

export interface ShareCreateResponse {
  slug: string;
  url: string;
}

/** A row from the `shares` table, post-fetch. */
export interface ShareRow {
  id: string;
  question_ids: string[];
  /** 0-100 inclusive (matches DB CHECK constraint) */
  score: number;
  feedback: string;
  result_type: string;
  category_scores: Partial<Record<Category, { correct: number; total: number }>>;
  created_at: string;
}
