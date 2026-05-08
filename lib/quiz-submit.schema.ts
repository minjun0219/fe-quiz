import { z } from "zod";
import type { Category, Choice, QuestionType } from "./question.schema";

/**
 * Per-question submitted answer:
 *   - `string`        — chosen choice id (single_choice)
 *   - `string[]`      — chosen choice ids (multi_choice; min 1)
 *   - `null`          — skipped
 */
export const SubmittedAnswer = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).min(1),
  z.null(),
]);
export type SubmittedAnswer = z.infer<typeof SubmittedAnswer>;

/** Body of POST /api/quiz/submit. */
export const QuizSubmitRequest = z
  .object({
    question_ids: z.array(z.string().min(1)).min(1).max(20),
    answers: z.array(SubmittedAnswer).min(1).max(20),
  })
  .superRefine((req, ctx) => {
    if (req.answers.length !== req.question_ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["answers"],
        message: `answers.length (${req.answers.length}) must equal question_ids.length (${req.question_ids.length})`,
      });
    }
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

export type QuizSubmitRequest = z.infer<typeof QuizSubmitRequest>;

/** Per-question result row in the API response. */
export interface QuizQuestionResult {
  id: string;
  category: Category;
  type: QuestionType;
  question: string;
  code?: string;
  choices: Choice[];
  your_answer: SubmittedAnswer;
  correct_answer: string | string[];
  is_correct: boolean;
  explanation: string;
}

/** Per-category aggregate. */
export interface CategoryScore {
  correct: number;
  total: number;
}

/** Diagnosis output piece. */
export interface Diagnosis {
  result_type: string;
  emoji: string;
  blurb: string;
  strengths: Category[];
  weaknesses: Category[];
}

/** Body of the API response. */
export interface QuizSubmitResponse extends Diagnosis {
  total: number;
  total_correct: number;
  category_scores: Partial<Record<Category, CategoryScore>>;
  per_question: QuizQuestionResult[];
}
