import { describe, expect, it } from "vitest";
import { GradingError, gradeRound } from "./grading";
import type { Question } from "./question.schema";

// Inline fixtures keep the tests independent of `content/questions/` content
// drift. Each minimal Question has just the fields gradeRound reads.
function single(id: string, choices: string[], answer: string): Question {
  return {
    id,
    category: "javascript",
    difficulty: "easy",
    type: "single_choice",
    question: `Q ${id}`,
    choices: choices.map((c) => ({ id: c, text: `text-${c}` })),
    answer,
    explanation: `expl ${id}`,
    tags: [],
  };
}

function multi(id: string, choices: string[], answer: string[]): Question {
  return {
    id,
    category: "react",
    difficulty: "medium",
    type: "multi_choice",
    question: `Q ${id}`,
    choices: choices.map((c) => ({ id: c, text: `text-${c}` })),
    answer,
    explanation: `expl ${id}`,
    tags: [],
  };
}

function lookup(qs: Question[]): (id: string) => Question | undefined {
  const m = new Map(qs.map((q) => [q.id, q] as const));
  return (id) => m.get(id);
}

describe("gradeRound — single_choice", () => {
  it("correct answer is_correct=true, total_correct increments", async () => {
    const q = single("js-1", ["a", "b", "c"], "b");
    const r = await gradeRound({ question_ids: ["js-1"], answers: ["b"] }, lookup([q]));
    expect(r.total).toBe(1);
    expect(r.total_correct).toBe(1);
    expect(r.per_question[0].is_correct).toBe(true);
  });

  it("wrong answer is_correct=false", async () => {
    const q = single("js-1", ["a", "b", "c"], "b");
    const r = await gradeRound({ question_ids: ["js-1"], answers: ["a"] }, lookup([q]));
    expect(r.total_correct).toBe(0);
    expect(r.per_question[0].is_correct).toBe(false);
  });

  it("null (skipped) counts as incorrect", async () => {
    const q = single("js-1", ["a", "b"], "a");
    const r = await gradeRound({ question_ids: ["js-1"], answers: [null] }, lookup([q]));
    expect(r.total_correct).toBe(0);
    expect(r.per_question[0].is_correct).toBe(false);
  });

  it("array submitted to single_choice → GradingError (400 hint)", async () => {
    const q = single("js-1", ["a", "b"], "a");
    await expect(
      gradeRound({ question_ids: ["js-1"], answers: [["a"]] }, lookup([q])),
    ).rejects.toBeInstanceOf(GradingError);
  });

  it("answer id outside choice set → GradingError", async () => {
    const q = single("js-1", ["a", "b"], "a");
    await expect(
      gradeRound({ question_ids: ["js-1"], answers: ["zzz"] }, lookup([q])),
    ).rejects.toBeInstanceOf(GradingError);
  });
});

describe("gradeRound — multi_choice", () => {
  it("exact match counts as correct", async () => {
    const q = multi("react-1", ["a", "b", "c", "d"], ["a", "c"]);
    const r = await gradeRound({ question_ids: ["react-1"], answers: [["a", "c"]] }, lookup([q]));
    expect(r.per_question[0].is_correct).toBe(true);
  });

  it("partial match (subset) is incorrect", async () => {
    const q = multi("react-1", ["a", "b", "c"], ["a", "c"]);
    const r = await gradeRound({ question_ids: ["react-1"], answers: [["a"]] }, lookup([q]));
    expect(r.per_question[0].is_correct).toBe(false);
  });

  it("superset (extra wrong pick) is incorrect", async () => {
    const q = multi("react-1", ["a", "b", "c"], ["a"]);
    const r = await gradeRound({ question_ids: ["react-1"], answers: [["a", "b"]] }, lookup([q]));
    expect(r.per_question[0].is_correct).toBe(false);
  });

  it("order-independent (set equality)", async () => {
    const q = multi("react-1", ["a", "b", "c"], ["a", "c"]);
    const r = await gradeRound({ question_ids: ["react-1"], answers: [["c", "a"]] }, lookup([q]));
    expect(r.per_question[0].is_correct).toBe(true);
  });

  it("string submitted to multi_choice → GradingError", async () => {
    const q = multi("react-1", ["a", "b"], ["a"]);
    await expect(
      gradeRound({ question_ids: ["react-1"], answers: ["a"] }, lookup([q])),
    ).rejects.toBeInstanceOf(GradingError);
  });

  it("duplicate ids in submission → GradingError", async () => {
    const q = multi("react-1", ["a", "b"], ["a"]);
    await expect(
      gradeRound({ question_ids: ["react-1"], answers: [["a", "a"]] }, lookup([q])),
    ).rejects.toBeInstanceOf(GradingError);
  });
});

describe("gradeRound — aggregation", () => {
  it("category_scores aggregates per category, mixed correct/wrong", async () => {
    const q1 = single("js-1", ["a", "b"], "a");
    const q2 = multi("react-1", ["a", "b"], ["a"]);
    const q3 = { ...single("css-1", ["a", "b"], "a"), category: "css" } as Question;
    const r = await gradeRound(
      {
        question_ids: ["js-1", "react-1", "css-1"],
        answers: ["a", ["b"], "a"],
      },
      lookup([q1, q2, q3]),
    );
    expect(r.total).toBe(3);
    expect(r.total_correct).toBe(2);
    expect(r.category_scores.javascript).toEqual({ correct: 1, total: 1 });
    expect(r.category_scores.react).toEqual({ correct: 0, total: 1 });
    expect(r.category_scores.css).toEqual({ correct: 1, total: 1 });
  });

  it("unknown question_id → GradingError before any work", async () => {
    const q = single("js-1", ["a", "b"], "a");
    await expect(
      gradeRound({ question_ids: ["js-99"], answers: [null] }, lookup([q])),
    ).rejects.toBeInstanceOf(GradingError);
  });
});

describe("gradeRound — displayed_choice_ids reordering", () => {
  it("response choices reflect the order client rendered (post-shuffle)", async () => {
    const q = single("js-1", ["a", "b", "c"], "a");
    const r = await gradeRound(
      {
        question_ids: ["js-1"],
        answers: ["a"],
        displayed_choice_ids: [["c", "a", "b"]],
      },
      lookup([q]),
    );
    expect(r.per_question[0].choices.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("displayed_choice_ids length mismatch → GradingError", async () => {
    const q = single("js-1", ["a", "b", "c"], "a");
    await expect(
      gradeRound(
        {
          question_ids: ["js-1"],
          answers: ["a"],
          displayed_choice_ids: [["a", "b"]],
        },
        lookup([q]),
      ),
    ).rejects.toBeInstanceOf(GradingError);
  });

  it("displayed_choice_ids referencing unknown id → GradingError", async () => {
    const q = single("js-1", ["a", "b"], "a");
    await expect(
      gradeRound(
        {
          question_ids: ["js-1"],
          answers: ["a"],
          displayed_choice_ids: [["a", "zzz"]],
        },
        lookup([q]),
      ),
    ).rejects.toBeInstanceOf(GradingError);
  });
});
