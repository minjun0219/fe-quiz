/**
 * `hint:` 필드 유출 린터.
 *
 * 힌트는 개념의 방향만 가리켜야 하고 정답을 좁혀주면 안 된다
 * (`content/AGENTS.md` 참고). 그 규칙 전체를 기계로 판정할 수는 없지만,
 * 확실한 두 가지는 정확히 잡힌다:
 *
 *   1. 정답 보기 텍스트를 통째로 옮겨 적은 경우.
 *   2. **정답만 가진 코드 토큰**을 힌트에서 부른 경우 — `space-between`,
 *      `unknown`, `useCallback` 같은 것들. 정답이 `justify-content:
 *      space-between`이면 값만 인용해도 유출이라, 문자열 전체 포함 검사만으로는
 *      못 잡는다. 그래서 보기별로 코드 토큰을 뽑아 **오답 어디에도 없는
 *      토큰**만 골라내고, 그게 힌트에 나오면 실패시킨다.
 *
 * 잡지 **못하는** 것도 분명히 해 둔다 — "A는 아니에요" 같은 소거법 단서,
 * 정답을 한국어로 바꿔 쓴 패러프레이즈. 이건 사람 검수 몫이다. 한국어는
 * 조사가 붙어 토큰 경계가 흐려서(`전에` vs `전`) 같은 방식을 쓰면 오탐이
 * 쏟아지고, 빌드를 막는 오탐이 놓친 유출보다 비싸다.
 *
 * `lint-question-prose.ts`와 달리 원문(raw YAML)이 아니라 파싱된
 * `Question[]`을 본다 — 힌트와 정답을 짝지어야 하는 검사라 코멘트 마커를
 * 읽을 이유가 없다. 호출처는 `scripts/check-questions.ts`.
 */
import type { Question } from "../lib/question.schema";

export type HintLeakHit = {
  id: string;
  reason: string;
  excerpt: string;
};

/**
 * 이보다 짧은 정답/토큰은 건너뛴다. 한두 글자짜리(`0`, `x`, `n`)는 아무
 * 문장에나 우연히 들어 있어서 잡아 봐야 오탐만 쌓인다. `any`처럼 실제로
 * 위험한 타입 키워드 답안은 3자라서 이 선 위에 남는다.
 */
const MIN_LEN = 3;

/** 앞뒤로 잘라 보여줄 발췌 길이. */
const EXCERPT_MAX = 80;

/**
 * 코드 토큰 — 식별자·CSS 값·API 이름. 한국어는 의도적으로 잡지 않는다
 * (위 주석의 오탐 문제). `space-between`, `box-sizing`, `Array.from`처럼
 * 하이픈·언더스코어·점으로 이어진 것도 한 토큰으로 본다.
 */
const CODE_TOKEN_RE = /[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*/gi;

/**
 * 비교용 정규화. 백틱·펜스는 **걷어내고 안쪽 텍스트는 남긴다** — 힌트가
 * `` `any` ``라고 쓰든 `any`라고 쓰든 같은 유출이기 때문이다.
 */
function normalize(s: string): string {
  return s
    .replace(/```[a-z]*\n?/gi, " ")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function codeTokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of normalize(s).matchAll(CODE_TOKEN_RE)) {
    if (m[0].length >= MIN_LEN) {
      out.add(m[0]);
    }
  }
  return out;
}

function excerpt(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= EXCERPT_MAX ? flat : `${flat.slice(0, EXCERPT_MAX)}…`;
}

function answerIds(q: Question): Set<string> {
  return new Set(q.type === "single_choice" ? [q.answer] : q.answer);
}

export function lintHintLeak(questions: readonly Question[]): HintLeakHit[] {
  const hits: HintLeakHit[] = [];

  for (const q of questions) {
    if (q.hint === undefined) {
      continue;
    }
    const hint = normalize(q.hint);
    const hintTokens = codeTokens(q.hint);
    const correct = answerIds(q);

    if (hint.includes("정답")) {
      hits.push({
        id: q.id,
        reason: '힌트가 "정답"을 직접 언급합니다',
        excerpt: excerpt(q.hint),
      });
    }

    // 오답이 이미 쓰고 있는 토큰은 변별력이 없다 — 네 보기가 전부
    // `justify-content`로 시작하면 그 이름을 부르는 건 아무것도 알려주지 않는다.
    const distractorTokens = new Set<string>();
    for (const c of q.choices) {
      if (!correct.has(c.id)) {
        for (const t of codeTokens(c.text)) {
          distractorTokens.add(t);
        }
      }
    }

    for (const c of q.choices) {
      if (!correct.has(c.id)) {
        continue;
      }

      const answer = normalize(c.text);
      if (answer.length >= MIN_LEN && hint.includes(answer)) {
        hits.push({
          id: q.id,
          reason: `힌트가 정답 보기 텍스트를 그대로 포함합니다: "${excerpt(c.text)}"`,
          excerpt: excerpt(q.hint),
        });
        continue;
      }

      for (const token of codeTokens(c.text)) {
        if (distractorTokens.has(token) || !hintTokens.has(token)) {
          continue;
        }
        hits.push({
          id: q.id,
          reason: `힌트가 정답에만 있는 코드 토큰 \`${token}\`을 부릅니다`,
          excerpt: excerpt(q.hint),
        });
      }
    }
  }

  return hits;
}

export function formatHintLeakHits(hits: readonly HintLeakHit[]): string {
  return hits
    .map((h) => `  ${h.id}\n    ${h.reason}\n    hint: ${h.excerpt}`)
    .join("\n\n");
}
