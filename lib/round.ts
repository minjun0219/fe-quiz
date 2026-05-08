import "server-only";
import type { PublicQuestion, Question } from "./question.schema";
import { getAllQuestions, getQuestionMap } from "./questions";

/** Number of questions per round. Falls back to pool size when seed < target. */
export const ROUND_SIZE = 5;

export function publicView(q: Question): PublicQuestion {
  const { answer: _answer, explanation: _explanation, ...rest } = q;
  return rest;
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
export function pickRoundQuestions(count = ROUND_SIZE): PublicQuestion[] {
  const safeCount = Math.max(0, Math.floor(count));
  const all = getAllQuestions();
  return shuffle(all).slice(0, Math.min(safeCount, all.length)).map(publicView);
}

/**
 * Replay a round by exact ID list, preserving the original order. Used by the
 * share flow so a friend's "나도 풀어보기" gets the same 5 questions in the
 * same sequence — that's what makes score comparisons meaningful.
 *
 * Unknown IDs are silently dropped (a question may have been retired between
 * the original round and the friend's replay).
 */
export function pickRoundQuestionsByIds(ids: readonly string[]): PublicQuestion[] {
  const map = getQuestionMap();
  const out: PublicQuestion[] = [];
  for (const id of ids) {
    const q = map.get(id);
    if (q) out.push(publicView(q));
  }
  return out;
}
