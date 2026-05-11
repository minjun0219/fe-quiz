import { CATEGORY_SHORT_LABEL } from "./category-labels";
import type { GradedRound } from "./grading";
import type { Category } from "./question.schema";
import type { Personality, Vibe } from "./quiz-submit.schema";

/**
 * Mascot ("누룽지") feedback system prompt for Haiku 4.5.
 * Kept short on purpose — falls below Haiku's 4096-token cache prefix minimum,
 * so prompt caching isn't activated. If we expand with more few-shot examples
 * later (and cross 4096 tokens), add `cache_control: {type: "ephemeral"}` on
 * this block.
 */
export const FEEDBACK_SYSTEM_PROMPT = `너는 '누룽지'라는 캐릭터야. 한국어 프론트엔드 개발자에게 단톡방 친한 동료처럼 한마디 보태주는 마스코트. 자기 이름을 굳이 들먹이지는 말고, '나'로 자연스럽게 말해.

규칙:
- 친근한 반말. 격식 X. 단톡방 분위기. "ㅋㅋ", "오", "어", "이거" 같은 자연스러운 추임새 OK.
- 4-6문장. 길어지면 어색해.
- 사용자 답안 데이터(맞고 틀린 문제, 약점 카테고리, 진단 페르소나·성향)를 보고 구체적으로 코멘트해. "잘했네" 만 하지 말고 어떤 부분이 좋았는지/아쉬웠는지 짚어.
- 진단 페르소나(예: "JS 사냥꾼")랑 성향(균형형/편식형) 호칭을 자연스럽게 한 번 정도 살려줘. 너무 우려먹지는 말고.
- 흐름: 잘한 부분 짧게 인정 → 틀린 문제 핵심 개념을 친한 동료 말투로 설명(해설을 그대로 베끼지 말고 자연스럽게) → 다음에 어떤 거 더 봐도 좋겠다는 가벼운 한 줄.
- 오답이 없으면 가장 헷갈렸을 만한 문제 짚어주거나, 압도적이라고 한 줄 더 쓰면서 마무리.
- 마크다운, 이모지, 불릿 X. 평문만.
- 광고/공부해라/면접대비 같은 학습 압박 멘트 절대 X.`;

interface BuildFeedbackUserInput {
  diagnosis: {
    result_type: string;
    emoji: string;
    blurb: string;
    personality: Personality;
    type_code: string;
    vibe: Vibe;
    strengths: Category[];
    weaknesses: Category[];
  };
  graded: GradedRound;
}

const PERSONALITY_KO: Record<Personality, string> = {
  balanced: "균형형",
  specialist: "편식형",
};

export function buildFeedbackUserPrompt({
  diagnosis,
  graded,
}: BuildFeedbackUserInput): string {
  const pct =
    graded.total === 0
      ? 0
      : Math.round((graded.total_correct / graded.total) * 100);

  const lines: string[] = [];
  lines.push(
    `진단: ${diagnosis.result_type} [${diagnosis.type_code}] (${PERSONALITY_KO[diagnosis.personality]}) — ${graded.total_correct}/${graded.total}, ${pct}%`,
  );
  lines.push(`전반 분위기: ${diagnosis.vibe.label}`);
  if (diagnosis.strengths.length > 0) {
    lines.push(
      `강점: ${diagnosis.strengths.map((c) => CATEGORY_SHORT_LABEL[c]).join(", ")}`,
    );
  }
  if (diagnosis.weaknesses.length > 0) {
    lines.push(
      `약점: ${diagnosis.weaknesses.map((c) => CATEGORY_SHORT_LABEL[c]).join(", ")}`,
    );
  }
  lines.push("");
  lines.push("푼 문제:");

  graded.per_question.forEach((q, i) => {
    const mark = q.is_correct ? "✓ 정답" : "✗ 오답";
    const textOf = (id: string) =>
      q.choices.find((c) => c.id === id)?.text ?? id;
    const yourLabel =
      q.your_answer === null
        ? "선택 없음"
        : Array.isArray(q.your_answer)
          ? q.your_answer.map(textOf).join(" / ")
          : textOf(q.your_answer);
    const correctLabel = Array.isArray(q.correct_answer)
      ? q.correct_answer.map(textOf).join(" / ")
      : textOf(q.correct_answer);

    lines.push(
      `${i + 1}. [${CATEGORY_SHORT_LABEL[q.category]} · ${mark}] ${q.question.replace(/\n+/g, " ").trim()}`,
    );
    lines.push(`   사용자 답: ${yourLabel}`);
    if (!q.is_correct) {
      lines.push(`   정답:     ${correctLabel}`);
    }
    lines.push(`   해설: ${q.explanation.replace(/\n+/g, " ").trim()}`);
  });

  lines.push("");
  lines.push("위 데이터 보고 단톡방 동료 톤으로 4-6문장 한마디 해줘.");

  return lines.join("\n");
}
