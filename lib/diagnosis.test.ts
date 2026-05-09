import { describe, expect, it } from "vitest";
import { diagnose, findResultType, RESULT_TYPES } from "./diagnosis";

describe("diagnose / overall accuracy → result_type bucket", () => {
  it("0 / 0 = 0% → 이제 시작!", () => {
    const r = diagnose({ total_correct: 0, total: 0, category_scores: {} });
    expect(r.result_type).toBe("이제 시작!");
    expect(r.emoji).toBe("🚀");
  });

  it("39% (just under WEAK_THRESHOLD=0.4) → 이제 시작!", () => {
    const r = diagnose({ total_correct: 39, total: 100, category_scores: {} });
    expect(r.result_type).toBe("이제 시작!");
  });

  it("40% boundary → 꿈나무", () => {
    const r = diagnose({ total_correct: 40, total: 100, category_scores: {} });
    expect(r.result_type).toBe("꿈나무");
  });

  it("60% boundary → 탄탄한 실무자", () => {
    const r = diagnose({ total_correct: 6, total: 10, category_scores: {} });
    expect(r.result_type).toBe("탄탄한 실무자");
  });

  it("80% boundary → 프론트엔드 마스터", () => {
    const r = diagnose({ total_correct: 4, total: 5, category_scores: {} });
    expect(r.result_type).toBe("프론트엔드 마스터");
  });

  it("100% → 프론트엔드 마스터", () => {
    const r = diagnose({ total_correct: 5, total: 5, category_scores: {} });
    expect(r.result_type).toBe("프론트엔드 마스터");
  });
});

describe("diagnose / strengths and weaknesses", () => {
  it("category at 100% → strengths; category at 0% → weaknesses", () => {
    const r = diagnose({
      total_correct: 1,
      total: 2,
      category_scores: {
        javascript: { correct: 1, total: 1 },
        react: { correct: 0, total: 1 },
      },
    });
    expect(r.strengths).toEqual(["javascript"]);
    expect(r.weaknesses).toEqual(["react"]);
  });

  it("middle accuracy (50%) is neither strong nor weak", () => {
    const r = diagnose({
      total_correct: 1,
      total: 2,
      category_scores: { css: { correct: 1, total: 2 } },
    });
    expect(r.strengths).toEqual([]);
    expect(r.weaknesses).toEqual([]);
  });

  it("empty bucket (total=0) is skipped — no NaN division", () => {
    const r = diagnose({
      total_correct: 0,
      total: 0,
      category_scores: { javascript: { correct: 0, total: 0 } },
    });
    expect(r.strengths).toEqual([]);
    expect(r.weaknesses).toEqual([]);
  });
});

describe("findResultType / share-page emoji recovery", () => {
  it("returns the same bucket diagnose chose", () => {
    const expected = RESULT_TYPES[0];
    const found = findResultType(expected.result_type);
    expect(found).toEqual(expected);
  });

  it("unknown name → fallback bucket (deterministic, no throw)", () => {
    const fallback = findResultType("v2-에서-추가된-가상의-진단명");
    expect(fallback.result_type).toBe("정체불명");
    expect(fallback.emoji).toBe("❓");
  });
});
