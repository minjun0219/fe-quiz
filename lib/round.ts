import "server-only";
import { highlightCode } from "./highlight";
import type { PublicQuestion, Question } from "./question.schema";
import { getAllQuestions, getQuestionMap } from "./questions";

/** Number of questions per round. Falls back to pool size when seed < target. */
export const ROUND_SIZE = 5;

export async function publicView(q: Question): Promise<PublicQuestion> {
  const { answer: _answer, explanation: _explanation, ...rest } = q;
  if (!rest.code) return rest;
  return { ...rest, code_html: await highlightCode(rest.code, rest.category) };
}

/** Fisher–Yates. Returns a fresh array without mutating input. */
function shuffle<T>(input: readonly T[]): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pick `count` questions at random from the full pool, return public view.
 * If the pool is smaller than `count`, returns whatever exists (early seeding).
 *
 * `count` is clamped to a non-negative integer so a user-controlled value
 * (e.g., a query param later) can't accidentally trigger surprising slice
 * semantics like `slice(0, -1)`.
 */
export async function pickRoundQuestions(count = ROUND_SIZE): Promise<PublicQuestion[]> {
  const safeCount = Math.max(0, Math.floor(count));
  const all = getAllQuestions();
  const picked = shuffle(all).slice(0, Math.min(safeCount, all.length));
  const views = await Promise.all(picked.map(publicView));
  return views.map((q) => ({ ...q, choices: shuffle(q.choices) }));
}

/**
 * Replay a round by exact ID list, preserving the original order. Used by the
 * share flow so a friend's "나도 풀어보기" gets the same 5 questions in the
 * same sequence — that's what makes score comparisons meaningful.
 *
 * Unknown IDs are silently dropped (a question may have been retired between
 * the original round and the friend's replay).
 */
export async function pickRoundQuestionsByIds(ids: readonly string[]): Promise<PublicQuestion[]> {
  const map = getQuestionMap();
  const found: Question[] = [];
  for (const id of ids) {
    const q = map.get(id);
    if (q) found.push(q);
  }
  return Promise.all(found.map(publicView));
}
