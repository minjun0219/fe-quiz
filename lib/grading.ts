import { highlightCode, highlightInlineBackticks } from "./highlight";
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
export async function gradeRound(
  req: QuizSubmitRequest,
  lookup: (id: string) => Question | undefined,
  opts: { withHtml?: boolean } = {},
): Promise<GradedRound> {
  // Resolve all ids upfront so an unknown id 400s before we pay any Shiki
  // cost, and so the per-question loop doesn't repeat the lookup.
  const questions: Question[] = req.question_ids.map((id) => {
    const q = lookup(id);
    if (!q) throw new GradingError(`unknown question_id "${id}"`);
    return q;
  });

  // Highlighting is opt-in: only the submit route renders the result UI and
  // needs Shiki/inline-code HTML. /api/quiz/feedback (LLM prompt) and
  // /api/share (id+score storage) never read these fields, so skipping the
  // WASM cold-start + per-question codeToHtml saves real latency.
  const codeHtmls = opts.withHtml
    ? await Promise.all(
        questions.map((q) =>
          q.code ? highlightCode(q.code, q.category) : Promise.resolve(undefined),
        ),
      )
    : null;

  const per_question: QuizQuestionResult[] = [];
  const category_scores: Partial<Record<Category, CategoryScore>> = {};
  let total_correct = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const id = q.id;
    const yours = req.answers[i];

    const choiceIds = new Set(q.choices.map((c) => c.id));
    const is_correct = checkAnswer(q, yours, choiceIds, id);
    if (is_correct) total_correct++;

    const bucket = category_scores[q.category] ?? { correct: 0, total: 0 };
    bucket.total++;
    if (is_correct) bucket.correct++;
    category_scores[q.category] = bucket;

    const displayedOrder = req.displayed_choice_ids?.[i];
    const orderedChoices = displayedOrder
      ? reorderChoices(q.choices, displayedOrder, id)
      : q.choices;
    const renderedChoices = opts.withHtml
      ? orderedChoices.map((c) => ({ ...c, text_html: highlightInlineBackticks(c.text) }))
      : orderedChoices;

    per_question.push({
      id: q.id,
      category: q.category,
      type: q.type,
      question: q.question,
      question_html: opts.withHtml ? highlightInlineBackticks(q.question) : undefined,
      code: q.code,
      code_html: codeHtmls?.[i],
      choices: renderedChoices,
      your_answer: yours,
      correct_answer: q.answer,
      is_correct,
      explanation: q.explanation,
      explanation_html: opts.withHtml ? highlightInlineBackticks(q.explanation) : undefined,
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

function reorderChoices(
  choices: Question["choices"],
  displayedOrder: string[],
  qid: string,
): Question["choices"] {
  if (displayedOrder.length !== choices.length) {
    throw new GradingError(
      `displayed_choice_ids for "${qid}" has ${displayedOrder.length} ids; expected ${choices.length}`,
    );
  }
  const byId = new Map(choices.map((c) => [c.id, c]));
  const out: Question["choices"] = [];
  const seen = new Set<string>();
  for (const id of displayedOrder) {
    if (seen.has(id)) {
      throw new GradingError(`duplicate displayed_choice_id "${id}" for "${qid}"`);
    }
    seen.add(id);
    const c = byId.get(id);
    if (!c) {
      throw new GradingError(`displayed_choice_id "${id}" not in choices for "${qid}"`);
    }
    out.push(c);
  }
  return out;
}

export class GradingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GradingError";
  }
}
