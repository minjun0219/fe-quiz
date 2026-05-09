import {
  CATEGORY_IDS,
  type CategoryEntry,
  findPersonaByName,
  getPersona,
} from "./categories";
import type { Category } from "./question.schema";
import type {
  CategoryScore,
  Diagnosis,
  Personality,
  Vibe,
} from "./quiz-submit.schema";

interface DiagnosisInput {
  total_correct: number;
  total: number;
  category_scores: Partial<Record<Category, CategoryScore>>;
}

/**
 * Per-category accuracy buckets. Exported so view layers can color-code
 * progress bars consistently with the diagnosis logic instead of redefining
 * `>= 0.8` / `< 0.4` inline. Values are in [0..1]; multiply by 100 for pct.
 */
export const STRONG_THRESHOLD = 0.8;
export const OK_THRESHOLD = 0.6;
export const WEAK_THRESHOLD = 0.4;

/**
 * Population standard deviation of per-category accuracies above which we
 * call the round a "specialist" pattern (lopsided) rather than "balanced"
 * (flat). 0.18 ≈ 18-point spread; tuned so a 60/60/60 stays balanced and
 * a 90/40/30 flips to specialist.
 */
export const BALANCED_STDDEV_THRESHOLD = 0.18;

interface VibeBucket extends Vibe {
  /** Lower bound (inclusive) of overall accuracy [0..1]. Highest → lowest. */
  min_accuracy: number;
}

/**
 * 4-level overall vibe (v1 buckets). Now a secondary line under the persona
 * hero rather than the main result. Read by `diagnose()` (live scoring) and
 * `findVibe()` (legacy share rows whose `result_type` predates personas).
 */
export const VIBE_BUCKETS: readonly VibeBucket[] = [
  {
    label: "프론트엔드 마스터",
    emoji: "🏆",
    blurb: "이건 그냥 책 한 권 다 외운 사람 아냐?",
    min_accuracy: STRONG_THRESHOLD,
  },
  {
    label: "탄탄한 실무자",
    emoji: "💪",
    blurb: "현업에서 자주 마주치는 패턴은 다 잡고 있네.",
    min_accuracy: OK_THRESHOLD,
  },
  {
    label: "꿈나무",
    emoji: "🌱",
    blurb: "기본기는 있어, 조금만 더 굴러보자.",
    min_accuracy: WEAK_THRESHOLD,
  },
  {
    label: "이제 시작!",
    emoji: "🚀",
    blurb: "괜찮아, 다들 여기서 시작했어.",
    min_accuracy: 0,
  },
];

const FALLBACK_VIBE: VibeBucket = {
  label: "정체불명",
  emoji: "❓",
  blurb: "이런 결과는 처음 보네.",
  min_accuracy: 0,
};

function pickVibe(overallAccuracy: number): VibeBucket {
  return (
    VIBE_BUCKETS.find((b) => overallAccuracy >= b.min_accuracy) ?? FALLBACK_VIBE
  );
}

/**
 * Look up a vibe bucket by label. Used by share pages whose stored
 * `result_type` is a legacy v1 bucket name (predating the persona system).
 */
export function findVibe(label: string): Vibe | null {
  return VIBE_BUCKETS.find((b) => b.label === label) ?? null;
}

interface ResolvedHero {
  name: string;
  emoji: string;
  blurb: string;
  /** Persona match (new shares) or null (legacy / unknown). */
  persona: CategoryEntry | null;
}

/**
 * Resolve a stored `result_type` string to a hero (persona for new shares,
 * legacy vibe for old). Lets share pages render a hero without re-grading.
 *
 * Precedence:
 *   1. Persona name (e.g., "JS 사냥꾼") — preferred.
 *   2. Legacy vibe label (e.g., "프론트엔드 마스터") — old shares.
 *   3. Fallback (deleted persona / corrupted row).
 */
export function resolveResultHero(stored_result_type: string): ResolvedHero {
  const persona = findPersonaByName(stored_result_type);
  if (persona) {
    return {
      name: persona.persona.name,
      emoji: persona.persona.emoji,
      blurb: persona.persona.blurb,
      persona,
    };
  }

  const vibe = findVibe(stored_result_type);
  if (vibe) {
    return {
      name: vibe.label,
      emoji: vibe.emoji,
      blurb: vibe.blurb,
      persona: null,
    };
  }

  return {
    name: FALLBACK_VIBE.label,
    emoji: FALLBACK_VIBE.emoji,
    blurb: FALLBACK_VIBE.blurb,
    persona: null,
  };
}

/**
 * Pick the dominant category by highest accuracy among scored categories.
 *
 * Tie-break (for determinism so the same input always renders the same
 * persona):
 *   1. Higher `correct` count wins.
 *   2. Earlier position in `CATEGORY_IDS` wins (= registry order).
 *
 * Returns null when no category has any attempts.
 */
export function pickDominantCategory(
  category_scores: Partial<Record<Category, CategoryScore>>,
): Category | null {
  let best: {
    cat: Category;
    acc: number;
    correct: number;
    order: number;
  } | null = null;
  for (let i = 0; i < CATEGORY_IDS.length; i++) {
    const cat = CATEGORY_IDS[i];
    const s = category_scores[cat];
    if (!s || s.total === 0) {
      continue;
    }
    const acc = s.correct / s.total;
    if (
      best === null ||
      acc > best.acc ||
      (acc === best.acc && s.correct > best.correct) ||
      (acc === best.acc && s.correct === best.correct && i < best.order)
    ) {
      best = { cat, acc, correct: s.correct, order: i };
    }
  }
  return best?.cat ?? null;
}

/**
 * Compute the personality axis from the spread of per-category accuracies.
 * Single-attempt or empty input defaults to "balanced".
 */
export function computePersonality(
  category_scores: Partial<Record<Category, CategoryScore>>,
): Personality {
  const accuracies: number[] = [];
  for (const s of Object.values(category_scores) as CategoryScore[]) {
    if (s && s.total > 0) {
      accuracies.push(s.correct / s.total);
    }
  }
  if (accuracies.length < 2) {
    return "balanced";
  }
  const mean = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  const variance =
    accuracies.reduce((sum, x) => sum + (x - mean) ** 2, 0) / accuracies.length;
  const stddev = Math.sqrt(variance);
  return stddev < BALANCED_STDDEV_THRESHOLD ? "balanced" : "specialist";
}

/**
 * Type code used as a shareable, OG-image-friendly tag.
 * Format: `${B|S}-${persona.code}` — e.g., `B-JS`, `S-React`, `B-CSS`.
 */
export function buildTypeCode(
  personality: Personality,
  dominant: Category | null,
): string {
  const prefix = personality === "balanced" ? "B" : "S";
  const suffix = dominant ? getPersona(dominant).code : "??";
  return `${prefix}-${suffix}`;
}

/**
 * Map a graded round to a hybrid persona × personality result.
 *
 * Output:
 *   - persona hero (`result_type`/`emoji`/`blurb`) from the dominant category
 *   - `personality` axis (balanced ↔ specialist) from cross-category variance
 *   - shareable `type_code` (e.g., "B-JS")
 *   - 4-level `vibe` overall mood (kept from v1 as a secondary line)
 *   - per-category strengths / weaknesses (unchanged thresholds)
 */
export function diagnose(input: DiagnosisInput): Diagnosis {
  const overall = input.total === 0 ? 0 : input.total_correct / input.total;
  const vibeBucket = pickVibe(overall);

  const dominant = pickDominantCategory(input.category_scores);
  const personality = computePersonality(input.category_scores);
  const type_code = buildTypeCode(personality, dominant);

  const persona = dominant ? getPersona(dominant) : null;
  const result_type = persona?.name ?? FALLBACK_VIBE.label;
  const emoji = persona?.emoji ?? FALLBACK_VIBE.emoji;
  const blurb = persona?.blurb ?? FALLBACK_VIBE.blurb;

  const strengths: Category[] = [];
  const weaknesses: Category[] = [];
  for (const [cat, s] of Object.entries(input.category_scores) as [
    Category,
    CategoryScore,
  ][]) {
    if (!s || s.total === 0) {
      continue;
    }
    const acc = s.correct / s.total;
    if (acc >= STRONG_THRESHOLD) {
      strengths.push(cat);
    } else if (acc < WEAK_THRESHOLD) {
      weaknesses.push(cat);
    }
  }

  return {
    result_type,
    emoji,
    blurb,
    personality,
    dominant_category: dominant,
    type_code,
    vibe: {
      label: vibeBucket.label,
      emoji: vibeBucket.emoji,
      blurb: vibeBucket.blurb,
    },
    strengths,
    weaknesses,
  };
}
