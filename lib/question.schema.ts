import { z } from "zod";
import {
  CATEGORY_IDS,
  type Category as CategoryId,
  getIdPrefix,
} from "./categories";

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

export const ReferenceSchema = z.object({
  title: z.string().min(1).max(200),
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), {
      message: "reference url must use https://",
    }),
});

export type Reference = z.infer<typeof ReferenceSchema>;

const Base = z.object({
  id: z.string().min(1),
  category: Category,
  difficulty: Difficulty,
  question: z.string().min(1),
  code: z.string().optional(),
  choices: z.array(ChoiceSchema).min(2).max(6),
  explanation: z.string().min(1),
  references: z.array(ReferenceSchema).min(1).max(5).optional(),
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

    if (q.references) {
      const seenUrls = new Set<string>();
      q.references.forEach((r, i) => {
        if (seenUrls.has(r.url)) {
          ctx.addIssue({
            code: "custom",
            path: ["references", i, "url"],
            message: `duplicate reference url "${r.url}"`,
          });
        }
        seenUrls.add(r.url);
      });
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
          message:
            "all choices marked correct — multi_choice must have at least one wrong choice",
        });
      }
    }
  });

export type Question = z.infer<typeof QuestionSchema>;

/**
 * Client-safe view of a question. The answer, explanation, and references
 * are intentionally omitted so the correct answer (and any topic hints from
 * MDN/spec links) never reaches the browser bundle before grading.
 *
 * Lives here (not in `lib/round.ts`) so client components can `import type`
 * this without crossing a `server-only` module boundary.
 *
 * `code_html` is server-rendered Shiki output for `code`; `question_html` and
 * each choice's `text_html` are HTML-escaped strings with single-backtick
 * runs wrapped in `<code class="inline-code">`. Clients render via
 * `dangerouslySetInnerHTML` and fall back to the raw text when absent.
 */
export type PublicChoice = Choice & {
  text_html?: string;
};

export type PublicQuestion = Omit<
  Question,
  "answer" | "explanation" | "choices" | "references"
> & {
  choices: PublicChoice[];
  question_html?: string;
  code_html?: string;
};

/**
 * `lib/questions.generated.json`에 실제로 들어 있는 모양 — YAML에서 온
 * `Question`에 **빌드 타임에 렌더한 HTML**이 얹혀 있다.
 *
 * 런타임은 이 문자열을 그대로 내보낸다. 마크다운·하이라이팅을 요청마다 다시
 * 하지 않으려는 것이고(라운드마다 10문항 × 2회 돌던 일이다), 덕분에 Prism이
 * 워커 번들에 안 들어간다 — 렌더는 `scripts/highlight.ts`가 빌드 때만 한다.
 *
 * 필드가 optional인 이유는 생성 시점 문제가 아니라 **배포와 번들 재생성이
 * 어긋나는 창** 때문이다. 옛 번들이 실린 채 새 코드가 뜨면 이 값들이 없는데,
 * 그때도 원문(`question`/`code`)으로 폴백해 화면은 뜨는 게 낫다.
 * 신선도 자체는 `pnpm questions:bundle:check`가 막는다.
 */
// `Question`은 single_choice/multi_choice 판별 유니온이라 그냥 `Omit`을 씌우면
// 유니온이 뭉개진다. 조건부 타입으로 분배해 각 갈래를 따로 확장한다.
type WithRenderedHtml<Q> = Q extends { choices: (infer C)[] }
  ? Omit<Q, "choices"> & {
      question_html?: string;
      explanation_html?: string;
      code_html?: string;
      choices: (C & { text_html?: string })[];
    }
  : never;

export type BundledQuestion = WithRenderedHtml<Question>;
