import type { Category, Question } from "./question.schema";
import type { CategoryScore, QuizQuestionResult, QuizSubmitRequest } from "./quiz-submit.schema";

export interface GradedRound {
  total: number;
  total_correct: number;
  category_scores: Partial<Record<Category, CategoryScore>>;
  per_question: QuizQuestionResult[];
}

/**
 * Pure scoring. Caller supplies a lookup so this stays decoupled from the fs
 * loader (easier to test, also lets the route handler reuse a Map).
 *
 * Throws if any submitted question_id is unknown — the route handler maps
 * that to a 400. answers.length === question_ids.length and answers within
 * choices range are pre-validated by the zod request schema (length) and
 * here (range).
 */
export function gradeRound(
  req: QuizSubmitRequest,
  lookup: (id: string) => Question | undefined,
): GradedRound {
  const per_question: QuizQuestionResult[] = [];
  const category_scores: Partial<Record<Category, CategoryScore>> = {};
  let total_correct = 0;

  for (let i = 0; i < req.question_ids.length; i++) {
    const id = req.question_ids[i];
    const yours = req.answers[i];
    const q = lookup(id);
    if (!q) {
      throw new GradingError(`unknown question_id "${id}"`);
    }
    if (yours !== null && yours >= q.choices.length) {
      throw new GradingError(
        `answer index ${yours} out of bounds for "${id}" (choices.length=${q.choices.length})`,
      );
    }

    const is_correct = yours !== null && yours === q.answer;
    if (is_correct) total_correct++;

    const bucket = category_scores[q.category] ?? { correct: 0, total: 0 };
    bucket.total++;
    if (is_correct) bucket.correct++;
    category_scores[q.category] = bucket;

    per_question.push({
      id: q.id,
      category: q.category,
      question: q.question,
      code: q.code,
      choices: q.choices,
      your_answer: yours,
      correct_answer: q.answer,
      is_correct,
      explanation: q.explanation,
    });
  }

  return {
    total: req.question_ids.length,
    total_correct,
    category_scores,
    per_question,
  };
}

export class GradingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GradingError";
  }
}
