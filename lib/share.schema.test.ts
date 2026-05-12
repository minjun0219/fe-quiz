import { describe, expect, it } from "vitest";
import { ShareRowSchema } from "./share.schema";

describe("ShareRowSchema", () => {
  // Regression: 카테고리를 새로 추가하면 zod 4의 `z.record(z.enum, …)`가
  // exhaustive 검사로 옛 row를 전부 reject → /r/[slug]가 404로 떨어졌음.
  // sparse category_scores도 통과해야 한다.
  it("accepts sparse category_scores (missing keys from CATEGORIES)", () => {
    const row = {
      id: "B-egWr3e",
      question_ids: ["js-001"],
      score: 90,
      feedback: "ok",
      result_type: "JS 사냥꾼",
      // browser/performance/nextjs 등 신규 카테고리 키 없음 — 정상.
      category_scores: {
        javascript: { correct: 2, total: 2 },
      },
      created_at: "2026-05-11T02:29:56.131131+00:00",
    };
    expect(ShareRowSchema.safeParse(row).success).toBe(true);
  });
});
