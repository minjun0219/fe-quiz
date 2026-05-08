import type { Category } from "./question.schema";
import type { CategoryScore, Diagnosis } from "./quiz-submit.schema";

interface DiagnosisInput {
  total_correct: number;
  total: number;
  category_scores: Partial<Record<Category, CategoryScore>>;
}

const STRONG_THRESHOLD = 0.8;
const WEAK_THRESHOLD = 0.4;

/**
 * Map a graded round to a friend-tone result label.
 *
 * v1: 4 buckets by overall accuracy. Will grow into MBTI-style combinations
 * once the seed pool covers more ground.
 */
export function diagnose(input: DiagnosisInput): Diagnosis {
  const overall = input.total === 0 ? 0 : input.total_correct / input.total;

  let result_type: string;
  let emoji: string;
  let blurb: string;

  if (overall >= STRONG_THRESHOLD) {
    result_type = "프론트엔드 마스터";
    emoji = "🏆";
    blurb = "이건 그냥 책 한 권 다 외운 사람 아냐?";
  } else if (overall >= 0.6) {
    result_type = "탄탄한 실무자";
    emoji = "💪";
    blurb = "현업에서 자주 마주치는 패턴은 다 잡고 있네.";
  } else if (overall >= WEAK_THRESHOLD) {
    result_type = "꿈나무";
    emoji = "🌱";
    blurb = "기본기는 있어, 조금만 더 굴러보자.";
  } else {
    result_type = "이제 시작!";
    emoji = "🚀";
    blurb = "괜찮아, 다들 여기서 시작했어.";
  }

  const strengths: Category[] = [];
  const weaknesses: Category[] = [];
  for (const [cat, s] of Object.entries(input.category_scores) as [Category, CategoryScore][]) {
    if (s.total === 0) continue;
    const acc = s.correct / s.total;
    if (acc >= STRONG_THRESHOLD) strengths.push(cat);
    else if (acc < WEAK_THRESHOLD) weaknesses.push(cat);
  }

  return { result_type, emoji, blurb, strengths, weaknesses };
}
