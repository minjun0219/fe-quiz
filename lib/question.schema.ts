import { z } from "zod";
import { CATEGORY_IDS, type Category as CategoryId, getIdPrefix } from "./categories";

/**
 * Category enum derived from `lib/categories.ts`. Adding a new category there
 * (e.g., TypeScript, HTML) automatically widens this enum — no edit here.
 */
export const Category = z.enum(CATEGORY_IDS);
export type Category = CategoryId;

export const Difficulty = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof Difficulty>;

export const QuestionType = z.enum(["single_choice", "multi_choice"]);
export type QuestionType = z.infer<typeof QuestionType>;

export const ChoiceSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(8)
    .regex(/^[a-z0-9_-]+$/, "choice id must be lowercase letters/digits/_-"),
  text: z.string().min(1),
});

export type Choice = z.infer<typeof ChoiceSchema>;

const Base = z.object({
  id: z.string().min(1),
  category: Category,
  difficulty: Difficulty,
  question: z.string().min(1),
  code: z.string().optional(),
  choices: z.array(ChoiceSchema).min(2).max(6),
  explanation: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

const SingleChoice = Base.extend({
  type: z.literal("single_choice"),
  answer: z.string().min(1),
});

const MultiChoice = Base.extend({
  type: z.literal("multi_choice"),
  answer: z.array(z.string().min(1)).min(1),
});

export const QuestionSchema = z
  .discriminatedUnion("type", [SingleChoice, MultiChoice])
  .superRefine((q, ctx) => {
    const expected = getIdPrefix(q.category);
    if (!q.id.startsWith(`${expected}-`)) {
      ctx.addIssue({
        code: "custom",
        path: ["id"],
        message: `id "${q.id}" must start with "${expected}-" for category "${q.category}"`,
      });
    }

    const seenIds = new Set<string>();
    const seenText = new Set<string>();
    for (let i = 0; i < q.choices.length; i++) {
      const c = q.choices[i];
      if (seenIds.has(c.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["choices", i, "id"],
          message: `duplicate choice id "${c.id}"`,
        });
      }
      seenIds.add(c.id);
      if (seenText.has(c.text)) {
        ctx.addIssue({
          code: "custom",
          path: ["choices", i, "text"],
          message: `duplicate choice text "${c.text}"`,
        });
      }
      seenText.add(c.text);
    }

    const choiceIds = new Set(q.choices.map((c) => c.id));

    if (q.type === "single_choice") {
      if (!choiceIds.has(q.answer)) {
        ctx.addIssue({
          code: "custom",
          path: ["answer"],
          message: `answer "${q.answer}" does not match any choice id`,
        });
      }
    } else {
      const seenAnswer = new Set<string>();
      q.answer.forEach((a, i) => {
        if (!choiceIds.has(a)) {
          ctx.addIssue({
            code: "custom",
            path: ["answer", i],
            message: `answer "${a}" does not match any choice id`,
          });
        }
        if (seenAnswer.has(a)) {
          ctx.addIssue({
            code: "custom",
            path: ["answer", i],
            message: `duplicate answer id "${a}"`,
          });
        }
        seenAnswer.add(a);
      });
      if (seenAnswer.size === q.choices.length) {
        ctx.addIssue({
          code: "custom",
          path: ["answer"],
          message: "all choices marked correct — multi_choice must have at least one wrong choice",
        });
      }
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
