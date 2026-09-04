import { describe, expect, it } from "vitest";
import { ShareRowSchema } from "./share.schema";

describe("ShareRowSchema", () => {
  // Regression: 카테고리를 새로 추가하면 zod 4의 `z.record(z.enum, …)`가
  // exhaustive 검사로 옛 row를 전부 reject → /r/[slug]가 404로 떨어졌음.
  // sparse category_scores도 통과해야 한다.
  const baseRow = {
    id: "B-egWr3e",
    question_ids: ["js-001"],
    score: 90,
    feedback: "ok",
    result_type: "JS 사냥꾼",
    category_scores: {
      // browser/performance/nextjs 등 신규 카테고리 키 없음 — 정상.
      javascript: { correct: 2, total: 2 },
    },
    created_at: "2026-05-11T02:29:56.131131+00:00",
  };

  it("accepts sparse category_scores (missing keys from CATEGORIES)", () => {
    expect(ShareRowSchema.safeParse(baseRow).success).toBe(true);
  });

  // partialRecord는 키 부재만 허용. enum에 없는 키는 여전히 reject —
  // 그래야 DB가 임의의 jsonb 쓰레기 키로 오염되어도 렌더 단계에서 차단된다.
  it("rejects keys not present in the Category enum", () => {
    const invalid = {
      ...baseRow,
      category_scores: {
        ...baseRow.category_scores,
        unknown: { correct: 1, total: 1 },
      },
    };
    expect(ShareRowSchema.safeParse(invalid).success).toBe(false);
  });
  // 배포와 마이그레이션이 별도 워크플로라 "새 코드 + 옛 스키마"인 순간이 있다.
  // 그때 nickname 키가 아예 없는데, 여기서 reject하면 모든 공유 링크가 죽는다
  // (지금은 404가 아니라 500으로 — `ShareLookup` 참고).
  it("nickname 키가 없어도 통과하고 null로 채워진다", () => {
    const parsed = ShareRowSchema.safeParse(baseRow);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.nickname).toBeNull();
  });

  it("nickname이 NULL이어도 null", () => {
    const parsed = ShareRowSchema.safeParse({ ...baseRow, nickname: null });
    expect(parsed.success && parsed.data.nickname).toBeNull();
  });

  it("nickname 문자열은 그대로 들고 온다", () => {
    const parsed = ShareRowSchema.safeParse({
      ...baseRow,
      nickname: "느긋한 물범",
    });
    expect(parsed.success && parsed.data.nickname).toBe("느긋한 물범");
  });
});
