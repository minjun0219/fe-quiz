/**
 * Build-time guard for round mechanics:
 *   - The stratified picker honors per-category guarantees over many trials.
 *   - Hybrid diagnosis (persona × personality × vibe) is deterministic and
 *     respects the documented thresholds.
 *
 * Run via `pnpm round:check`. Wired into `prebuild` alongside the YAML check.
 *
 * Imports the pure picker (`lib/round-picker.ts`) directly so we never load
 * `server-only` from a Node script.
 */
import { join } from "node:path";
import { CATEGORIES } from "../lib/categories";
import {
  BALANCED_STDDEV_THRESHOLD,
  buildTypeCode,
  computePersonality,
  diagnose,
  pickDominantCategory,
  resolveResultHero,
} from "../lib/diagnosis";
import { LEVELS } from "../lib/levels";
import { loadAllQuestions } from "../lib/load-questions";
import type { Category, Difficulty, Question } from "../lib/question.schema";
import type { CategoryScore } from "../lib/quiz-submit.schema";
import {
  effectiveMinPerCategory,
  pickByLevel,
  pickStratified,
  ROUND_SIZE,
} from "../lib/round-picker";

const TRIALS = 1000;
const ROOT = join(process.cwd(), "content/questions");

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function pass(msg: string) {
  console.log(`✓ ${msg}`);
}

function buildPoolByCategory(all: Question[]): Map<Category, Question[]> {
  const out = new Map<Category, Question[]>();
  for (const c of CATEGORIES) {
    out.set(c.id, []);
  }
  for (const q of all) {
    const bucket = out.get(q.category);
    if (bucket) {
      bucket.push(q);
    }
  }
  return out;
}

function roundChecks() {
  const all = loadAllQuestions(ROOT);
  if (all.length === 0) {
    pass("round picker: no questions seeded yet, skipping invariants");
    return;
  }

  const poolByCat = buildPoolByCategory(all);
  const getPool = (c: Category) => poolByCat.get(c) ?? [];

  const N = CATEGORIES.length;
  const minPerCat = effectiveMinPerCategory(ROUND_SIZE, N);
  const expectedSize = Math.min(ROUND_SIZE, all.length);

  for (let trial = 0; trial < TRIALS; trial++) {
    const round = pickStratified(ROUND_SIZE, getPool);

    if (round.length !== expectedSize) {
      fail(
        `trial ${trial}: expected ${expectedSize} questions, got ${round.length}`,
      );
    }

    const seen = new Set<string>();
    const perCatCount = new Map<Category, number>();
    for (const q of round) {
      if (seen.has(q.id)) {
        fail(`trial ${trial}: duplicate question id "${q.id}" in round`);
      }
      seen.add(q.id);
      perCatCount.set(q.category, (perCatCount.get(q.category) ?? 0) + 1);
    }

    if (N * minPerCat <= ROUND_SIZE) {
      for (const cat of CATEGORIES) {
        const got = perCatCount.get(cat.id) ?? 0;
        const cap = Math.min(minPerCat, getPool(cat.id).length);
        if (got < cap) {
          fail(
            `trial ${trial}: category "${cat.id}" got ${got}, expected ≥ ${cap}`,
          );
        }
      }
    }
  }
  pass(
    `round picker: ${TRIALS} trials, size=${expectedSize}, min/cat=${minPerCat} (N=${N})`,
  );
}

function levelMixChecks() {
  const all = loadAllQuestions(ROOT);
  if (all.length === 0) {
    pass("level mix: no questions seeded yet, skipping invariants");
    return;
  }

  const poolByCat = buildPoolByCategory(all);
  const getPool = (c: Category) => poolByCat.get(c) ?? [];
  const expectedSize = Math.min(ROUND_SIZE, all.length);

  const totalByDiff: Record<Difficulty, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };
  for (const q of all) {
    totalByDiff[q.difficulty]++;
  }

  for (const level of LEVELS) {
    // Lower bound: when global pool ≥ mix quota, the picker must hit it
    // exactly (no fallback fires); otherwise the bound is the pool size.
    const minBy: Record<Difficulty, number> = {
      easy: Math.min(level.mix.easy, totalByDiff.easy),
      medium: Math.min(level.mix.medium, totalByDiff.medium),
      hard: Math.min(level.mix.hard, totalByDiff.hard),
    };

    for (let trial = 0; trial < TRIALS; trial++) {
      const round = pickByLevel(level.id, ROUND_SIZE, getPool);

      if (round.length !== expectedSize) {
        fail(
          `level=${level.id} trial ${trial}: expected ${expectedSize} questions, got ${round.length}`,
        );
      }

      const seen = new Set<string>();
      const got: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
      for (const q of round) {
        if (seen.has(q.id)) {
          fail(`level=${level.id} trial ${trial}: duplicate id "${q.id}"`);
        }
        seen.add(q.id);
        got[q.difficulty]++;
      }

      for (const d of ["easy", "medium", "hard"] as const) {
        if (got[d] < minBy[d]) {
          fail(
            `level=${level.id} trial ${trial}: ${d} got ${got[d]}, expected ≥ ${minBy[d]} (mix=${level.mix[d]}, pool=${totalByDiff[d]})`,
          );
        }
      }
    }
    pass(
      `level mix [${level.id}]: ${TRIALS} trials, mix=${JSON.stringify(level.mix)}, lower bound=${JSON.stringify(minBy)}`,
    );
  }
}

function diagnosisChecks() {
  // Tie-break determinism: same input → same persona, runs 50x.
  const tied: Record<string, CategoryScore> = {
    javascript: { correct: 4, total: 5 },
    react: { correct: 4, total: 5 },
    css: { correct: 4, total: 5 },
  };
  const first = pickDominantCategory(tied);
  for (let i = 0; i < 50; i++) {
    const again = pickDominantCategory(tied);
    if (again !== first) {
      fail(`tie-break non-deterministic: ${first} vs ${again}`);
    }
  }
  pass(`diagnose: deterministic tie-break (got ${first} for 4/5 across cats)`);

  // Higher correct count wins on equal accuracy.
  const correctCountTie: Record<string, CategoryScore> = {
    javascript: { correct: 2, total: 4 }, // 50%
    react: { correct: 4, total: 8 }, // 50%, more correct
  };
  const winner = pickDominantCategory(correctCountTie);
  if (winner !== "react") {
    fail(`expected react to win on correct count, got ${winner}`);
  }
  pass("diagnose: higher `correct` wins equal-accuracy tie");

  // Single-category attempts → balanced.
  const onlyJs = computePersonality({ javascript: { correct: 3, total: 5 } });
  if (onlyJs !== "balanced") {
    fail(`expected balanced for single-cat, got ${onlyJs}`);
  }
  pass("diagnose: single-category attempts default to balanced");

  // Flat 60/60/60 → balanced (stddev 0 < threshold).
  const flat = computePersonality({
    javascript: { correct: 3, total: 5 },
    react: { correct: 3, total: 5 },
    css: { correct: 3, total: 5 },
  });
  if (flat !== "balanced") {
    fail(`expected balanced for flat, got ${flat}`);
  }

  // Lopsided 100/40/20 → specialist (stddev ≈ 0.33 > threshold).
  const lopsided = computePersonality({
    javascript: { correct: 5, total: 5 },
    react: { correct: 2, total: 5 },
    css: { correct: 1, total: 5 },
  });
  if (lopsided !== "specialist") {
    fail(`expected specialist for lopsided, got ${lopsided}`);
  }
  pass(
    `diagnose: stddev threshold ${BALANCED_STDDEV_THRESHOLD} separates flat vs lopsided`,
  );

  // Type code format.
  const code = buildTypeCode("balanced", "javascript");
  if (!/^[BS]-[A-Za-z]+$/.test(code)) {
    fail(`bad type_code format: ${code}`);
  }
  pass(`diagnose: type_code format (e.g., ${code})`);

  // Full diagnose smoke: 8/10 on JS, 4/5 on React/CSS.
  const d = diagnose({
    total_correct: 16,
    total: 20,
    category_scores: {
      javascript: { correct: 8, total: 10 },
      react: { correct: 4, total: 5 },
      css: { correct: 4, total: 5 },
    },
  });
  if (d.dominant_category === null) {
    fail("expected a dominant category");
  }
  if (
    d.type_code.split("-")[0] !== (d.personality === "balanced" ? "B" : "S")
  ) {
    fail(`type_code prefix mismatch: ${d.type_code} vs ${d.personality}`);
  }
  if (!d.vibe.label) {
    fail("vibe label missing");
  }
  pass(
    `diagnose: full path returns ${d.result_type} ${d.type_code} (${d.personality}) · vibe=${d.vibe.label}`,
  );

  // Legacy fallback resolution.
  const legacy = resolveResultHero("프론트엔드 마스터");
  if (legacy.persona !== null) {
    fail("legacy vibe label must not match a persona");
  }
  if (legacy.emoji !== "🏆") {
    fail(`legacy emoji mismatch: ${legacy.emoji}`);
  }
  pass("diagnose: legacy share row falls back to v1 vibe bucket");

  // New persona resolution.
  const fresh = resolveResultHero("JS 사냥꾼");
  if (fresh.persona === null) {
    fail("expected persona match for new share row");
  }
  pass(
    `diagnose: new share row resolves to persona ${fresh.persona?.persona.name}`,
  );
}

try {
  roundChecks();
  levelMixChecks();
  diagnosisChecks();
  console.log("\n✓ all round + diagnosis invariants pass");
} catch (err) {
  console.error("✗ round/diagnosis check threw:", (err as Error).message);
  process.exit(1);
}
