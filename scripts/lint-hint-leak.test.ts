import { describe, expect, it } from "vitest";
import type { Question } from "../lib/question.schema";
import { lintHintLeak } from "./lint-hint-leak";

function question(over: Partial<Question> = {}): Question {
  return {
    id: "js-001",
    category: "javascript",
    difficulty: "medium",
    type: "single_choice",
    question: "다음 코드의 출력 결과는?",
    choices: [
      { id: "a", text: "이벤트 루프" },
      { id: "b", text: "마이크로태스크 큐" },
    ],
    answer: "b",
    explanation: "설명",
    tags: [],
    ...over,
  } as Question;
}

describe("lintHintLeak", () => {
  it("힌트가 없는 문항은 통과시킨다", () => {
    expect(lintHintLeak([question()])).toEqual([]);
  });

  it("개념의 방향만 가리키는 힌트는 통과시킨다", () => {
    const q = question({ hint: "어떤 큐가 먼저 비워지는지 떠올려 봐요." });
    expect(lintHintLeak([q])).toEqual([]);
  });

  it("정답 보기 텍스트를 그대로 포함하면 잡는다", () => {
    const q = question({ hint: "마이크로태스크 큐가 먼저 비워져요." });
    const hits = lintHintLeak([q]);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("js-001");
    expect(hits[0].reason).toContain("마이크로태스크 큐");
  });

  it("오답 보기 텍스트는 잡지 않는다 — 소거법은 사람 검수 몫", () => {
    const q = question({ hint: "이벤트 루프 이야기처럼 보이지만 아니에요." });
    expect(lintHintLeak([q])).toEqual([]);
  });

  it("백틱 유무는 유출 판정을 바꾸지 않는다", () => {
    const q = question({
      choices: [
        { id: "a", text: "`unknown`" },
        { id: "b", text: "`any`" },
      ],
      answer: "b",
      hint: "타입을 좁히지 못하면 any로 떨어져요.",
    });
    expect(lintHintLeak([q])).toHaveLength(1);
  });

  it("정답에만 있는 코드 토큰은 값만 인용해도 잡는다", () => {
    const q = question({
      category: "css",
      id: "css-001",
      choices: [
        { id: "a", text: "`justify-content: space-between`" },
        { id: "b", text: "`justify-content: space-around`" },
      ],
      answer: "a",
      hint: "space-between을 떠올려 보세요.",
    });
    const hits = lintHintLeak([q]);
    expect(hits).toHaveLength(1);
    expect(hits[0].reason).toContain("space-between");
  });

  it("보기 전부가 공유하는 코드 토큰은 변별력이 없어 통과시킨다", () => {
    const q = question({
      category: "css",
      id: "css-001",
      choices: [
        { id: "a", text: "`justify-content: space-between`" },
        { id: "b", text: "`justify-content: space-around`" },
      ],
      answer: "a",
      hint: "네 값 모두 `justify-content`라 가장자리 간격에서 갈려요.",
    });
    expect(lintHintLeak([q])).toEqual([]);
  });

  it("한국어 조사 차이로는 오탐을 내지 않는다", () => {
    const q = question({
      category: "typescript",
      id: "ts-001",
      choices: [
        { id: "a", text: "①은 통과, ②는 컴파일 에러 — 좁히기 전에 사용 불가" },
        { id: "b", text: "①, ② 모두 컴파일 에러 — 둘 다 사용 전 검사 필요" },
      ],
      answer: "a",
      hint: "다른 하나는 쓰기 전에 뭔지 확인하라고 요구해요.",
    });
    expect(lintHintLeak([q])).toEqual([]);
  });

  it("두 글자 이하 정답은 오탐을 피하려 건너뛴다", () => {
    const q = question({
      choices: [
        { id: "a", text: "1" },
        { id: "b", text: "0" },
      ],
      answer: "b",
      hint: "0부터 세는지 1부터 세는지 확인해 봐요.",
    });
    expect(lintHintLeak([q])).toEqual([]);
  });

  it('"정답"을 직접 언급하면 잡는다', () => {
    const q = question({ hint: "정답을 고르기 전에 실행 순서를 보세요." });
    const hits = lintHintLeak([q]);
    expect(hits).toHaveLength(1);
    expect(hits[0].reason).toContain("정답");
  });

  it("multi_choice는 정답으로 표시된 보기를 전부 본다", () => {
    const q = question({
      type: "multi_choice",
      choices: [
        { id: "a", text: "이벤트 루프" },
        { id: "b", text: "마이크로태스크 큐" },
        { id: "c", text: "매크로태스크 큐" },
      ],
      answer: ["a", "c"],
      hint: "매크로태스크 큐를 먼저 보세요.",
    });
    expect(lintHintLeak([q])).toHaveLength(1);
  });
});
