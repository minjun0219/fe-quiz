import type { Question } from "./question.schema";
import questionsData from "./questions.generated.json";

/**
 * 전체 문제 풀 — 빌드 타임에 `scripts/build-questions-json.ts`가 zod 검증을
 * 통과시켜 직렬화한 `questions.generated.json`을 정적 import한다 (Workers에는
 * 런타임 파일시스템이 없다). 검증은 생성 시점에 끝났으므로 여기서는 타입
 * 단언만 한다. 스테일 방지는 `pnpm questions:bundle:check`(prebuild/check 게이트).
 *
 * 서버 전용(.server.ts) — 정답·해설이 포함된 원본이므로 클라이언트 코드에서
 * import 금지. 클라이언트로는 `publicView()`를 거친 데이터만 나간다 (ADR 0005).
 */
const ALL: readonly Question[] = Object.freeze(
  questionsData as unknown as Question[],
);

export function getAllQuestions(): readonly Question[] {
  return ALL;
}

export function getQuestionsByCategory(
  category: Question["category"],
): readonly Question[] {
  return ALL.filter((q) => q.category === category);
}

const MAP: ReadonlyMap<string, Question> = new Map(ALL.map((q) => [q.id, q]));

/** id → Question 인덱스. 모듈 초기화 시 1회 구성. */
export function getQuestionMap(): ReadonlyMap<string, Question> {
  return MAP;
}

export function getQuestionById(id: string): Question | undefined {
  return MAP.get(id);
}
