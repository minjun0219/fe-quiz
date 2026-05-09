import "server-only";
import { highlightCode } from "./highlight";
import type { PublicQuestion, Question } from "./question.schema";
import { getQuestionMap, getQuestionsByCategory } from "./questions";
import { pickStratified, ROUND_SIZE, shuffle } from "./round-picker";

export {
  effectiveMinPerCategory,
  ROUND_SIZE,
  TARGET_MIN_PER_CATEGORY,
} from "./round-picker";

export async function publicView(q: Question): Promise<PublicQuestion> {
  const { answer: _answer, explanation: _explanation, ...rest } = q;
  if (!rest.code) return rest;
  return { ...rest, code_html: await highlightCode(rest.code, rest.category) };
}

/**
 * Pick a round from the live filesystem-loaded pool, return public view with
 * choices shuffled.
 *
 * Server-only — wires the pure stratified picker (`lib/round-picker.ts`) up
 * to `getQuestionsByCategory`, which filters the cached `getAllQuestions()`
 * pool by category on each call (O(N) over the frozen pool, fine at current
 * seed sizes). Adding new categories to the registry needs no changes here.
 */
export async function pickRoundQuestions(count = ROUND_SIZE): Promise<PublicQuestion[]> {
  const picked = pickStratified(count, getQuestionsByCategory);
  const views = await Promise.all(picked.map(publicView));
  return views.map((q) => ({ ...q, choices: shuffle(q.choices) }));
}

/**
 * Replay a round by exact ID list, preserving the original order. Used by the
 * share flow so a friend's "나도 풀어보기" gets the same questions in the
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
