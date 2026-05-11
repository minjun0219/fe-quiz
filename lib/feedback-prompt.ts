import { CATEGORY_SHORT_LABEL } from "./category-labels";
import type { GradedRound } from "./grading";
import { getLevel, type Level } from "./levels";
import type { Category } from "./question.schema";
import type { Personality, Vibe } from "./quiz-submit.schema";

/**
 * Mascot ("누룽지") feedback system prompt for Haiku 4.5.
 * Kept short on purpose — falls below Haiku's 4096-token cache prefix minimum,
 * so prompt caching isn't activated. If we expand with more few-shot examples
 * later (and cross 4096 tokens), add `cache_control: {type: "ephemeral"}` on
 * this block.
 */
export const FEEDBACK_SYSTEM_PROMPT = `너는 '누룽지'라는 캐릭터야. 한국어 프론트엔드 개발자에게 옆자리에서 같이 일하는 친한 동료처럼 차분하게 한마디 보태주는 마스코트. 자기 이름을 굳이 들먹이지는 말고, '나'로 자연스럽게 말해.

규칙:
- 친한 동료끼리 쓰는 부드러운 존댓말. "~네요", "~더라고요", "~봐도 좋을 것 같아요" 같은 톤. 격식체 일변도는 아니고 따뜻하게.
- 반말, "ㅋㅋ"/"오"/"어"/"이거" 같은 추임새, 이모지, 단톡방 말투 전부 금지. 가볍게 들리지 않게.
- 5-8문장을 2-3개의 짧은 단락으로 나눠 주세요. 단락 사이는 빈 줄(\n\n) 한 줄로 띄우고, 한 단락이 모바일에서 벽처럼 보이지 않게 합니다. 흐름은 잘한 부분 → 틀린 핵심 개념 → 다음에 볼 만한 부분 순서가 자연스러워요.
- 사용자 답안 데이터(맞고 틀린 문제, 약점 카테고리, 진단 페르소나·성향, 선택 레벨)를 보고 구체적으로 코멘트하세요. "잘했네요" 만 말고 어떤 부분이 좋았는지/아쉬웠는지 짚어 주세요.
- 선택 레벨에 맞춰 톤·기대치를 조절하세요. 입문(워밍업)이면 격려 위주에 개념 base를, 보통이면 균형 있게, 도전(쫄깃)이면 디테일과 심화 포인트까지 짚어 주세요. 레벨 이름 자체를 직접 부르지는 마세요.
- 진단 페르소나(예: "JS 사냥꾼")랑 성향(균형형/편식형) 호칭은 자연스럽게 한 번 정도만 살려 주세요. 너무 우려먹지는 말고.
- 틀린 문제 핵심 개념은 동료 말투로 또렷하게 설명하세요(해설을 그대로 베끼지 말고 자연스럽게).
- 오답이 없으면 가장 헷갈렸을 만한 문제를 짚어 주거나, 안정적이라는 코멘트 한 줄로 마무리하세요.
- 코드 식별자·API·옵션 이름(예: \`display\`, \`useEffect\`, \`box-sizing\`)은 백틱으로 감싸 주세요. 단락 사이 빈 줄 외에는 마크다운(**, 불릿, 헤더), 이모지, 리스트 형식 모두 쓰지 마세요. 평문 단락 + 인라인 백틱만.
- 광고/공부해라/면접대비 같은 학습 압박 멘트 절대 금지.`;

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
  /** User-selected difficulty level. Optional for backward compat — older
   *  clients (or share replays without the URL hint) submit without it. */
  level?: Level;
}

const PERSONALITY_KO: Record<Personality, string> = {
  balanced: "균형형",
  specialist: "편식형",
};

export function buildFeedbackUserPrompt({
  diagnosis,
  graded,
  level,
}: BuildFeedbackUserInput): string {
  const pct =
    graded.total === 0
      ? 0
      : Math.round((graded.total_correct / graded.total) * 100);

  const lines: string[] = [];
  lines.push(
    `진단: ${diagnosis.result_type} [${diagnosis.type_code}] (${PERSONALITY_KO[diagnosis.personality]}) — ${graded.total_correct}/${graded.total}, ${pct}%`,
  );
  if (level) {
    const entry = getLevel(level);
    const mix = entry.mix;
    lines.push(
      `선택 레벨: ${entry.display} (${entry.blurb}; easy ${mix.easy}/medium ${mix.medium}/hard ${mix.hard})`,
    );
  }
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
  lines.push("위 데이터 보고 친한 동료의 존댓말로 5-8문장 피드백해 주세요.");

  return lines.join("\n");
}
