import type { Difficulty } from "./question.schema";

/**
 * Single source of truth for difficulty levels.
 *
 * Each level prescribes a target easy/medium/hard mix that sums to
 * `ROUND_SIZE` (10). The picker (`lib/round-picker.ts`) treats this as a
 * priority quota: it tries to honor the mix exactly, but falls back to
 * adjacent difficulties when the pool can't satisfy it (e.g., HTML has 0
 * hard, so a `challenge` round substitutes medium for HTML's hard slot).
 *
 * `intro` and `challenge` are *blends*, not pure-difficulty — the global
 * hard pool is small (~7 questions) and not every category has hard
 * coverage, so all-hard or all-easy isn't viable.
 */
export const LEVELS = [
  {
    id: "intro",
    display: "입문",
    blurb: "워밍업으로 가볍게",
    mix: { easy: 7, medium: 3, hard: 0 },
  },
  {
    id: "normal",
    display: "보통",
    blurb: "적당히 섞어서",
    mix: { easy: 3, medium: 6, hard: 1 },
  },
  {
    id: "challenge",
    display: "도전",
    blurb: "쫄깃하게 진짜 실력 검증",
    mix: { easy: 0, medium: 5, hard: 5 },
  },
] as const;

export type Level = (typeof LEVELS)[number]["id"];
export type LevelEntry = (typeof LEVELS)[number];
export type DifficultyMix = Readonly<Record<Difficulty, number>>;

export const LEVEL_IDS = LEVELS.map((l) => l.id) as [Level, ...Level[]];

export const DEFAULT_LEVEL: Level = "normal";

const BY_ID: Record<Level, LevelEntry> = Object.fromEntries(
  LEVELS.map((l) => [l.id, l]),
) as Record<Level, LevelEntry>;

export function getLevel(id: Level): LevelEntry {
  return BY_ID[id];
}

export function isLevel(s: unknown): s is Level {
  return typeof s === "string" && s in BY_ID;
}

/** Coerce arbitrary input (e.g., URL search params) to a valid level. */
export function toLevel(s: unknown): Level {
  return isLevel(s) ? s : DEFAULT_LEVEL;
}
