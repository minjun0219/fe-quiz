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

/**
 * Body of POST /api/quiz/submit.
 *
 * `displayed_choice_ids` carries the choice id order the client actually
 * rendered (post-shuffle). When present, the grading response echoes back
 * `choices` in the same order so the result UI matches what the user saw.
 * Optional so the feedback flow can omit it without a contract break.
 */
export const QuizSubmitRequest = z
  .object({
    question_ids: z.array(z.string().min(1)).min(1).max(20),
    answers: z.array(SubmittedAnswer).min(1).max(20),
    displayed_choice_ids: z.array(z.array(z.string().min(1)).min(2).max(6)).optional(),
  })
  .superRefine((req, ctx) => {
    if (req.answers.length !== req.question_ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["answers"],
        message: `answers.length (${req.answers.length}) must equal question_ids.length (${req.question_ids.length})`,
      });
    }
    if (req.displayed_choice_ids && req.displayed_choice_ids.length !== req.question_ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["displayed_choice_ids"],
        message: `displayed_choice_ids.length (${req.displayed_choice_ids.length}) must equal question_ids.length (${req.question_ids.length})`,
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
  /** Server-rendered Shiki HTML for `code`. */
  code_html?: string;
  choices: Choice[];
  your_answer: SubmittedAnswer;
  correct_answer: string | string[];
  is_correct: boolean;
  explanation: string;
  /** Server-rendered HTML for `explanation` with inline backtick spans. */
  explanation_html?: string;
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
