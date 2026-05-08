import { z } from "zod";

export const Category = z.enum(["javascript", "react", "css"]);
export type Category = z.infer<typeof Category>;

export const Difficulty = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof Difficulty>;

const ID_PREFIX: Record<Category, string> = {
  javascript: "js",
  react: "react",
  css: "css",
};

export const QuestionSchema = z
  .object({
    id: z.string().min(1),
    category: Category,
    difficulty: Difficulty,
    type: z.literal("multiple_choice"),
    question: z.string().min(1),
    code: z.string().optional(),
    choices: z.array(z.string().min(1)).min(2).max(6),
    answer: z.number().int().nonnegative(),
    explanation: z.string().min(1),
    tags: z.array(z.string()).default([]),
  })
  .superRefine((q, ctx) => {
    if (q.answer >= q.choices.length) {
      ctx.addIssue({
        code: "custom",
        path: ["answer"],
        message: `answer ${q.answer} is out of bounds (choices.length=${q.choices.length})`,
      });
    }
    const expected = ID_PREFIX[q.category];
    if (!q.id.startsWith(`${expected}-`)) {
      ctx.addIssue({
        code: "custom",
        path: ["id"],
        message: `id "${q.id}" must start with "${expected}-" for category "${q.category}"`,
      });
    }
    // Choices are competing answers — duplicates would be a content bug AND
    // collide with React keys keyed off choice text.
    const seen = new Set<string>();
    for (let i = 0; i < q.choices.length; i++) {
      const choice = q.choices[i];
      if (seen.has(choice)) {
        ctx.addIssue({
          code: "custom",
          path: ["choices", i],
          message: `duplicate choice text "${choice}"`,
        });
      }
      seen.add(choice);
    }
  });

export type Question = z.infer<typeof QuestionSchema>;

/**
 * Client-safe view of a question. The answer + explanation are intentionally
 * omitted so the correct answer never reaches the browser bundle.
 *
 * Lives here (not in `lib/round.ts`) so client components can `import type`
 * this without crossing a `server-only` module boundary.
 */
export type PublicQuestion = Omit<Question, "answer" | "explanation">;
