import type { Category } from "./question.schema";
import type { CategoryScore, Diagnosis } from "./quiz-submit.schema";

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

interface ResultTypeBucket {
  result_type: string;
  emoji: string;
  blurb: string;
  /** Lower bound (inclusive) of overall accuracy [0..1]. Buckets evaluated from highest to lowest. */
  min_accuracy: number;
}

/**
 * v1 result-type buckets, ordered high → low. Read both by `diagnose()` (live
 * scoring) and `findResultType()` (looking up emoji/blurb for a stored share).
 */
export const RESULT_TYPES: readonly ResultTypeBucket[] = [
  {
    result_type: "프론트엔드 마스터",
    emoji: "🏆",
    blurb: "이건 그냥 책 한 권 다 외운 사람 아냐?",
    min_accuracy: STRONG_THRESHOLD,
  },
  {
    result_type: "탄탄한 실무자",
    emoji: "💪",
    blurb: "현업에서 자주 마주치는 패턴은 다 잡고 있네.",
    min_accuracy: OK_THRESHOLD,
  },
  {
    result_type: "꿈나무",
    emoji: "🌱",
    blurb: "기본기는 있어, 조금만 더 굴러보자.",
    min_accuracy: WEAK_THRESHOLD,
  },
  {
    result_type: "이제 시작!",
    emoji: "🚀",
    blurb: "괜찮아, 다들 여기서 시작했어.",
    min_accuracy: 0,
  },
];

const FALLBACK_BUCKET: ResultTypeBucket = {
  result_type: "정체불명",
  emoji: "❓",
  blurb: "이런 결과는 처음 보네.",
  min_accuracy: 0,
};

/**
 * Look up emoji + blurb for an already-named result_type. Used by share
 * pages to rebuild the diagnosis hero from a stored row without re-grading.
 * Returns a deterministic fallback if the name is unknown (e.g., a name
 * deprecated by a future RESULT_TYPES change).
 */
export function findResultType(result_type: string): ResultTypeBucket {
  return RESULT_TYPES.find((b) => b.result_type === result_type) ?? FALLBACK_BUCKET;
}

/**
 * Map a graded round to a friend-tone result label.
 *
 * v1: 4 buckets by overall accuracy. Will grow into MBTI-style combinations
 * once the seed pool covers more ground.
 */
export function diagnose(input: DiagnosisInput): Diagnosis {
  const overall = input.total === 0 ? 0 : input.total_correct / input.total;
  const bucket = RESULT_TYPES.find((b) => overall >= b.min_accuracy) ?? FALLBACK_BUCKET;

  const strengths: Category[] = [];
  const weaknesses: Category[] = [];
  for (const [cat, s] of Object.entries(input.category_scores) as [Category, CategoryScore][]) {
    if (s.total === 0) continue;
    const acc = s.correct / s.total;
    if (acc >= STRONG_THRESHOLD) strengths.push(cat);
    else if (acc < WEAK_THRESHOLD) weaknesses.push(cat);
  }

  return {
    result_type: bucket.result_type,
    emoji: bucket.emoji,
    blurb: bucket.blurb,
    strengths,
    weaknesses,
  };
}
