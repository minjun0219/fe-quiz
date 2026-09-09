import { describe, expect, it } from "vitest";
import { type NudgeInput, nudgeThresholdMs } from "./hint-policy";

function input(over: Partial<NudgeInput> = {}): NudgeInput {
  return {
    changeCount: 0,
    isRevisit: false,
    difficulty: "medium",
    answered: 0,
    correct: 0,
    categoryWrong: 0,
    ...over,
  };
}

describe("nudgeThresholdMs", () => {
  it("신호가 없으면 기본 임계값", () => {
    expect(nudgeThresholdMs(input())).toBe(35_000);
  });

  it("재방문은 기다리지 않는다", () => {
    expect(nudgeThresholdMs(input({ isRevisit: true }))).toBe(0);
  });

  it("재방문은 다른 어떤 조정보다 우선한다", () => {
    const t = nudgeThresholdMs(
      input({ isRevisit: true, difficulty: "hard", answered: 5, correct: 5 }),
    );
    expect(t).toBe(0);
  });

  it("같은 카테고리에서 이미 틀렸으면 앞당긴다", () => {
    expect(nudgeThresholdMs(input({ categoryWrong: 1 }))).toBe(20_000);
  });

  it("잘 가고 있으면 미룬다", () => {
    expect(nudgeThresholdMs(input({ answered: 5, correct: 5 }))).toBe(60_000);
  });

  it("표본이 3문항 미만이면 잘한다고 보지 않는다", () => {
    expect(nudgeThresholdMs(input({ answered: 2, correct: 2 }))).toBe(35_000);
  });

  it("정답률 80% 미만이면 잘한다고 보지 않는다", () => {
    expect(nudgeThresholdMs(input({ answered: 5, correct: 3 }))).toBe(35_000);
  });

  it("카테고리 신호가 정답률보다 우선한다", () => {
    const t = nudgeThresholdMs(
      input({ answered: 5, correct: 4, categoryWrong: 1 }),
    );
    expect(t).toBe(20_000);
  });

  it("hard는 원래 오래 걸리므로 더 기다린다", () => {
    expect(nudgeThresholdMs(input({ difficulty: "hard" }))).toBe(45_000);
  });

  it("선택을 여러 번 갈아치우면 앞당긴다", () => {
    expect(nudgeThresholdMs(input({ changeCount: 3 }))).toBe(25_000);
  });

  it("신호가 겹쳐도 바닥 아래로는 안 내려간다", () => {
    const t = nudgeThresholdMs(input({ categoryWrong: 2, changeCount: 9 }));
    expect(t).toBe(10_000);
    expect(t).toBeGreaterThanOrEqual(8_000);
  });

  it("답을 하나도 안 한 상태에서 0으로 나누지 않는다", () => {
    expect(nudgeThresholdMs(input({ answered: 0, correct: 0 }))).toBe(35_000);
  });
});
