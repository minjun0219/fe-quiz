import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the question loader so tests don't depend on the actual content/* tree
// or hit the fs at all. Each test sets up its own minimal pool.
vi.mock("./questions", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test pool is mutable
  let pool: any[] = [];
  return {
    getAllQuestions: () => pool,
    getQuestionMap: () => new Map(pool.map((q) => [q.id, q])),
    // biome-ignore lint/suspicious/noExplicitAny: test seeder
    __setPool: (p: any[]) => {
      pool = p;
    },
  };
});

// `lib/highlight` does Shiki WASM load, which we don't want in unit tests.
vi.mock("./highlight", () => ({
  highlightCode: async (code: string) => `<pre>${code}</pre>`,
  highlightInlineBackticks: async (s: string) => s,
}));

import type { Question } from "./question.schema";
import * as questionsMod from "./questions";
import { pickRoundQuestions, pickRoundQuestionsByIds, publicView, ROUND_SIZE } from "./round";

function single(id: string): Question {
  return {
    id,
    category: "javascript",
    difficulty: "easy",
    type: "single_choice",
    question: `Q ${id}`,
    choices: [
      { id: "a", text: "a" },
      { id: "b", text: "b" },
    ],
    answer: "a",
    explanation: `expl ${id}`,
    tags: [],
  };
}

function setPool(qs: Question[]) {
  // biome-ignore lint/suspicious/noExplicitAny: hidden test seam
  (questionsMod as any).__setPool(qs);
}

describe("publicView", () => {
  it("strips answer + explanation; keeps choices/category/etc.", async () => {
    const view = await publicView(single("js-1"));
    // biome-ignore lint/suspicious/noExplicitAny: probe stripped fields
    expect((view as any).answer).toBeUndefined();
    // biome-ignore lint/suspicious/noExplicitAny: probe stripped fields
    expect((view as any).explanation).toBeUndefined();
    expect(view.id).toBe("js-1");
    expect(view.choices).toHaveLength(2);
  });
});

describe("pickRoundQuestions", () => {
  beforeEach(() => {
    setPool([single("js-1"), single("js-2"), single("js-3")]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("default count is ROUND_SIZE; falls back to pool size when smaller", async () => {
    const round = await pickRoundQuestions();
    // pool has 3, ROUND_SIZE=5 → 3 returned (no padding)
    expect(round).toHaveLength(3);
    expect(ROUND_SIZE).toBe(5);
  });

  it("count clamps to non-negative integer", async () => {
    expect(await pickRoundQuestions(-5)).toHaveLength(0);
    expect(await pickRoundQuestions(2.9)).toHaveLength(2);
  });

  it("count of 0 returns empty round", async () => {
    expect(await pickRoundQuestions(0)).toHaveLength(0);
  });

  it("returns public view (no answer/explanation in any item)", async () => {
    const round = await pickRoundQuestions(2);
    for (const q of round) {
      // biome-ignore lint/suspicious/noExplicitAny: probe stripped fields
      expect((q as any).answer).toBeUndefined();
      // biome-ignore lint/suspicious/noExplicitAny: probe stripped fields
      expect((q as any).explanation).toBeUndefined();
    }
  });
});

describe("pickRoundQuestionsByIds (replay)", () => {
  beforeEach(() => {
    setPool([single("js-1"), single("js-2"), single("js-3")]);
  });

  it("preserves the requested order", async () => {
    const r = await pickRoundQuestionsByIds(["js-3", "js-1", "js-2"]);
    expect(r.map((q) => q.id)).toEqual(["js-3", "js-1", "js-2"]);
  });

  it("silently drops unknown ids (deleted between original and replay)", async () => {
    const r = await pickRoundQuestionsByIds(["js-1", "js-99", "js-2"]);
    expect(r.map((q) => q.id)).toEqual(["js-1", "js-2"]);
  });

  it("empty list returns empty round (caller decides fallback)", async () => {
    const r = await pickRoundQuestionsByIds([]);
    expect(r).toHaveLength(0);
  });
});
