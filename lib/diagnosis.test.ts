import { describe, expect, it } from "vitest";
import {
  buildTypeCode,
  computePersonality,
  diagnose,
  findVibe,
  pickDominantCategory,
  resolveResultHero,
  VIBE_BUCKETS,
} from "./diagnosis";

describe("diagnose / overall accuracy → vibe bucket", () => {
  it("0 / 0 = 0% → 이제 시작!", () => {
    const r = diagnose({ total_correct: 0, total: 0, category_scores: {} });
    expect(r.vibe.label).toBe("이제 시작!");
    expect(r.vibe.emoji).toBe("🚀");
  });

  it("39% (just under WEAK_THRESHOLD=0.4) → 이제 시작!", () => {
    const r = diagnose({ total_correct: 39, total: 100, category_scores: {} });
    expect(r.vibe.label).toBe("이제 시작!");
  });

  it("40% boundary → 꿈나무", () => {
    const r = diagnose({ total_correct: 40, total: 100, category_scores: {} });
    expect(r.vibe.label).toBe("꿈나무");
  });

  it("60% boundary → 탄탄한 실무자", () => {
    const r = diagnose({ total_correct: 6, total: 10, category_scores: {} });
    expect(r.vibe.label).toBe("탄탄한 실무자");
  });

  it("80% boundary → 프론트엔드 마스터", () => {
    const r = diagnose({ total_correct: 4, total: 5, category_scores: {} });
    expect(r.vibe.label).toBe("프론트엔드 마스터");
  });

  it("100% → 프론트엔드 마스터", () => {
    const r = diagnose({ total_correct: 5, total: 5, category_scores: {} });
    expect(r.vibe.label).toBe("프론트엔드 마스터");
  });
});

describe("diagnose / persona hero from dominant category", () => {
  it("dominant javascript → JS 사냥꾼 persona", () => {
    const r = diagnose({
      total_correct: 5,
      total: 10,
      category_scores: {
        javascript: { correct: 4, total: 5 },
        react: { correct: 1, total: 5 },
      },
    });
    expect(r.result_type).toBe("JS 사냥꾼");
    expect(r.emoji).toBe("🦊");
    expect(r.dominant_category).toBe("javascript");
  });

  it("no attempts → fallback hero (정체불명)", () => {
    const r = diagnose({ total_correct: 0, total: 0, category_scores: {} });
    expect(r.result_type).toBe("정체불명");
    expect(r.emoji).toBe("❓");
    expect(r.dominant_category).toBeNull();
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

describe("pickDominantCategory tie-breaks", () => {
  it("higher correct count wins on equal accuracy", () => {
    const dom = pickDominantCategory({
      javascript: { correct: 1, total: 1 },
      react: { correct: 4, total: 4 },
    });
    expect(dom).toBe("react");
  });

  it("registry order wins on full tie", () => {
    const dom = pickDominantCategory({
      javascript: { correct: 2, total: 2 },
      react: { correct: 2, total: 2 },
    });
    expect(dom).toBe("javascript");
  });

  it("returns null when no category has any attempts", () => {
    expect(pickDominantCategory({})).toBeNull();
    expect(
      pickDominantCategory({ javascript: { correct: 0, total: 0 } }),
    ).toBeNull();
  });
});

describe("computePersonality (balanced ↔ specialist)", () => {
  it("flat 60/60/60 stays balanced", () => {
    const p = computePersonality({
      javascript: { correct: 6, total: 10 },
      react: { correct: 6, total: 10 },
      css: { correct: 6, total: 10 },
    });
    expect(p).toBe("balanced");
  });

  it("lopsided 90/40/30 flips to specialist", () => {
    const p = computePersonality({
      javascript: { correct: 9, total: 10 },
      react: { correct: 4, total: 10 },
      css: { correct: 3, total: 10 },
    });
    expect(p).toBe("specialist");
  });

  it("single category defaults to balanced (insufficient spread signal)", () => {
    expect(computePersonality({ javascript: { correct: 5, total: 10 } })).toBe(
      "balanced",
    );
  });
});

describe("buildTypeCode", () => {
  it("balanced + javascript → B-JS", () => {
    expect(buildTypeCode("balanced", "javascript")).toBe("B-JS");
  });

  it("specialist + react → S-React", () => {
    expect(buildTypeCode("specialist", "react")).toBe("S-React");
  });

  it("missing dominant → '??' suffix", () => {
    expect(buildTypeCode("balanced", null)).toBe("B-??");
  });
});

describe("findVibe / resolveResultHero / share-page recovery", () => {
  it("findVibe returns the same bucket for a known label", () => {
    const expected = VIBE_BUCKETS[0];
    const found = findVibe(expected.label);
    expect(found?.label).toBe(expected.label);
    expect(found?.emoji).toBe(expected.emoji);
  });

  it("findVibe returns null for unknown label", () => {
    expect(findVibe("v2-에서-추가된-가상의-진단명")).toBeNull();
  });

  it("resolveResultHero prefers persona match over vibe", () => {
    const hero = resolveResultHero("JS 사냥꾼");
    expect(hero.name).toBe("JS 사냥꾼");
    expect(hero.emoji).toBe("🦊");
    expect(hero.persona).not.toBeNull();
  });

  it("resolveResultHero falls back to legacy vibe for old shares", () => {
    const hero = resolveResultHero("프론트엔드 마스터");
    expect(hero.name).toBe("프론트엔드 마스터");
    expect(hero.emoji).toBe("🏆");
    expect(hero.persona).toBeNull();
  });

  it("resolveResultHero unknown name → 정체불명 fallback (no throw)", () => {
    const hero = resolveResultHero("v2-에서-추가된-가상의-진단명");
    expect(hero.name).toBe("정체불명");
    expect(hero.emoji).toBe("❓");
    expect(hero.persona).toBeNull();
  });
});
