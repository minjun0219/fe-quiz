import { DEFAULT_LEVEL, type Level } from "./levels";
import type {
  BundledQuestion,
  PublicChoice,
  PublicQuestion,
} from "./question.schema";
import { getQuestionMap, getQuestionsByCategory } from "./questions.server";
import { pickByLevel, ROUND_SIZE, shuffle } from "./round-picker";

export {
  effectiveMinPerCategory,
  ROUND_SIZE,
  TARGET_MIN_PER_CATEGORY,
} from "./round-picker";

/**
 * 클라이언트로 나갈 모양으로 좁힌다. HTML은 번들에 이미 렌더돼 있어서
 * 여기서는 고르기만 한다 — 예전에는 문항마다 마크다운·하이라이팅을 다시 돌렸다.
 */
export function publicView(q: BundledQuestion): PublicQuestion {
  const {
    answer: _answer,
    explanation: _explanation,
    explanation_html: _explanationHtml,
    references: _references,
    choices,
    code,
    code_html,
    ...rest
  } = q;
  return {
    ...rest,
    choices: choices.map(
      (c): PublicChoice => ({ ...c, text_html: c.text_html }),
    ),
    ...(code !== undefined ? { code, code_html } : {}),
  };
}

/**
 * Pick a round from the live filesystem-loaded pool, return public view with
 * choices shuffled.
 *
 * Server-only — wires the pure level-aware picker (`lib/round-picker.ts`) up
 * to `getQuestionsByCategory`, which filters the cached `getAllQuestions()`
 * pool by category on each call (O(N) over the frozen pool, fine at current
 * seed sizes). Adding new categories to the registry needs no changes here.
 *
 * `level` selects the easy/medium/hard mix; `count` is an upper cap that
 * trims the result if smaller than the mix sum (lets tests probe clamping
 * without overriding `ROUND_SIZE` globally).
 */
export async function pickRoundQuestions(
  count: number = ROUND_SIZE,
  level: Level = DEFAULT_LEVEL,
): Promise<PublicQuestion[]> {
  const picked = pickByLevel(level, count, getQuestionsByCategory);
  const views = picked.map(publicView);
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
export async function pickRoundQuestionsByIds(
  ids: readonly string[],
): Promise<PublicQuestion[]> {
  const map = getQuestionMap();
  const found: BundledQuestion[] = [];
  for (const id of ids) {
    const q = map.get(id);
    if (q) {
      found.push(q);
    }
  }
  return found.map(publicView);
}
