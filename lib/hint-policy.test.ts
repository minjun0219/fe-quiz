import { describe, expect, it } from "vitest";
import { type NudgeInput, nudgeThresholdMs } from "./hint-policy";

function input(over: Partial<NudgeInput> = {}): NudgeInput {
  return {
    changeCount: 0,
    isRevisit: false,
    difficulty: "medium",
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
      input({ isRevisit: true, difficulty: "hard", changeCount: 9 }),
    );
    expect(t).toBe(0);
  });

  it("hard는 원래 오래 걸리므로 더 기다린다", () => {
    expect(nudgeThresholdMs(input({ difficulty: "hard" }))).toBe(45_000);
  });

  it("선택을 여러 번 갈아치우면 앞당긴다", () => {
    expect(nudgeThresholdMs(input({ changeCount: 3 }))).toBe(25_000);
  });

  it("번복 2회까지는 고민으로 보지 않는다", () => {
    expect(nudgeThresholdMs(input({ changeCount: 2 }))).toBe(35_000);
  });

  it("hard에서 번복하면 두 조정이 상쇄된다", () => {
    expect(
      nudgeThresholdMs(input({ difficulty: "hard", changeCount: 3 })),
    ).toBe(35_000);
  });

  it("신호가 겹쳐도 바닥 아래로는 안 내려간다", () => {
    const t = nudgeThresholdMs(input({ changeCount: 99 }));
    expect(t).toBeGreaterThanOrEqual(8_000);
  });

  it("클라이언트가 아는 값만 받는다 — 성적은 입력이 아니다", () => {
    const keys = Object.keys(input()).sort();
    expect(keys).toEqual(["changeCount", "difficulty", "isRevisit"]);
  });
});
