import { CATEGORY_IDS, type Category } from "./categories";
import type { PublicQuestion, Question } from "./question.schema";

/** Number of questions per round. Falls back to pool size when seed < target. */
export const ROUND_SIZE = 10;

/**
 * Target minimum questions guaranteed per active category. Auto-shrinks when
 * the registry grows past `ROUND_SIZE / TARGET_MIN_PER_CATEGORY` so a future
 * 8-category world still gets 1-per-category coverage rather than crowding
 * out smaller categories.
 *
 * Exported for the round-picker invariant test.
 */
export const TARGET_MIN_PER_CATEGORY = 2;

/**
 * Effective per-category guarantee for the given category count and round
 * size. Drops to `floor(roundSize / N)` (min 1) when packing 2-per-cat would
 * exceed the round budget.
 */
export function effectiveMinPerCategory(roundSize: number, categoryCount: number): number {
  if (categoryCount <= 0 || roundSize <= 0) return 0;
  if (categoryCount * TARGET_MIN_PER_CATEGORY <= roundSize) return TARGET_MIN_PER_CATEGORY;
  return Math.max(1, Math.floor(roundSize / categoryCount));
}

export function publicView(q: Question): PublicQuestion {
  const { answer: _answer, explanation: _explanation, ...rest } = q;
  return rest;
}

/** Fisher–Yates. Returns a fresh array without mutating input. */
export function shuffle<T>(input: readonly T[]): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Stratified picker — pure function form. Caller supplies a per-category
 * pool getter, so this stays decoupled from the fs loader (the route reuses
 * a server-cached map; the test script feeds it a freshly loaded pool).
 *
 * Guarantee: when `N * effectiveMinPerCategory(...) <= roundSize`, every
 * active category contributes at least that many (or all it has, if its
 * pool is smaller); the rest is randomly filled from the global remainder.
 * In the pathological case where the registry is so large that even one
 * question per category would exceed `roundSize` (`N > roundSize`), the
 * picker over-allocates to the per-cat floor of 1 and then trims to
 * `roundSize`, so some categories may end up with 0 in that round.
 * Final list is reshuffled so categories interleave instead of clumping.
 *
 * Designed to scale with `CATEGORIES`: adding a new category in
 * `lib/categories.ts` automatically participates in the stratification with
 * no edits here.
 *
 * Returns the raw `Question[]` (not `PublicQuestion[]`); the caller decides
 * whether to apply `publicView` + choice-shuffle.
 */
export function pickStratified(
  roundSize: number,
  getPool: (cat: Category) => readonly Question[],
): Question[] {
  const safeCount = Math.max(0, Math.floor(roundSize));
  if (safeCount === 0) return [];

  const minPerCat = effectiveMinPerCategory(safeCount, CATEGORY_IDS.length);

  const picked: Question[] = [];
  const seen = new Set<string>();
  const remainder: Question[] = [];

  for (const cat of CATEGORY_IDS) {
    const pool = shuffle(getPool(cat));
    const take = Math.min(minPerCat, pool.length);
    for (let i = 0; i < take; i++) {
      picked.push(pool[i]);
      seen.add(pool[i].id);
    }
    for (let i = take; i < pool.length; i++) {
      remainder.push(pool[i]);
    }
  }

  // When N * minPerCat > roundSize (many tiny categories vs. small round),
  // we may have already over-allocated — trim down via a final shuffle.
  if (picked.length >= safeCount) {
    return shuffle(picked).slice(0, safeCount);
  }

  // Iterate-and-skip rather than `slice(0, need)`: if the remainder ever
  // shares an id with `picked` (cross-category overlap, registry drift),
  // slicing first could leave the round short. Iterating until full keeps
  // the `seen` guard meaningful.
  if (picked.length < safeCount && remainder.length > 0) {
    for (const q of shuffle(remainder)) {
      if (picked.length >= safeCount) break;
      if (!seen.has(q.id)) {
        picked.push(q);
        seen.add(q.id);
      }
    }
  }

  return shuffle(picked);
}
