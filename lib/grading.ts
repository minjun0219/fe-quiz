import type { Category, Question } from "./question.schema";
import type {
  CategoryScore,
  QuizQuestionResult,
  QuizSubmitRequest,
  SubmittedAnswer,
} from "./quiz-submit.schema";

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
 * that to a 400. Each submitted answer's shape is validated against its
 * question's `type` here (single_choice → string|null, multi_choice →
 * string[]|null) so a mismatch surfaces as a 400 instead of silent miss.
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

    const choiceIds = new Set(q.choices.map((c) => c.id));
    const is_correct = checkAnswer(q, yours, choiceIds, id);
    if (is_correct) total_correct++;

    const bucket = category_scores[q.category] ?? { correct: 0, total: 0 };
    bucket.total++;
    if (is_correct) bucket.correct++;
    category_scores[q.category] = bucket;

    per_question.push({
      id: q.id,
      category: q.category,
      type: q.type,
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

function checkAnswer(
  q: Question,
  yours: SubmittedAnswer,
  choiceIds: Set<string>,
  qid: string,
): boolean {
  if (yours === null) return false;

  if (q.type === "single_choice") {
    if (typeof yours !== "string") {
      throw new GradingError(`"${qid}" is single_choice; expected string answer`);
    }
    if (!choiceIds.has(yours)) {
      throw new GradingError(`answer "${yours}" not a valid choice id for "${qid}"`);
    }
    return yours === q.answer;
  }

  // multi_choice
  if (!Array.isArray(yours)) {
    throw new GradingError(`"${qid}" is multi_choice; expected array of strings`);
  }
  for (const a of yours) {
    if (!choiceIds.has(a)) {
      throw new GradingError(`answer "${a}" not a valid choice id for "${qid}"`);
    }
  }
  const yourSet = new Set(yours);
  if (yourSet.size !== yours.length) {
    throw new GradingError(`duplicate answer ids in submission for "${qid}"`);
  }
  if (yourSet.size !== q.answer.length) return false;
  for (const a of q.answer) {
    if (!yourSet.has(a)) return false;
  }
  return true;
}

export class GradingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GradingError";
  }
}
