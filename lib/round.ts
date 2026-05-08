import "server-only";
import type { Question } from "./question.schema";
import { getAllQuestions } from "./questions";

/** Number of questions per round. Falls back to pool size when seed < target. */
export const ROUND_SIZE = 5;

/**
 * Client-safe view of a question. The answer + explanation are intentionally
 * stripped server-side so the correct answer never reaches the browser bundle.
 */
export type PublicQuestion = Omit<Question, "answer" | "explanation">;

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
 */
export function pickRoundQuestions(count = ROUND_SIZE): PublicQuestion[] {
  const all = getAllQuestions();
  return shuffle(all).slice(0, Math.min(count, all.length)).map(publicView);
}
