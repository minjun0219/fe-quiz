# Quiz content — agent guide

Rules for writing or modifying `content/questions/**/*.yaml`. The renderer
is `renderQuizMarkdown` in `lib/highlight.ts`, and these conventions are
enforced by `pnpm questions:check` (which `prebuild` runs).

For human-oriented context (tone, contributor onboarding, examples), see
`content/README.md`.

## At a glance

| What you are showing | Wrap with |
| --- | --- |
| Single identifier / keyword / one-line expression / type literal | `` `code` `` (inline backticks) |
| Multi-line code / JSX / function body / multi-line object | ` ```lang … ``` ` (fenced block, prefer a language tag) |
| Semantic emphasis | `**bold**` |
| The question's main code sample | YAML `code:` field (plain text, no backticks) |

## Inline backticks

Always wrap with `` `…` ``:

- Single identifier, keyword, operator: `` `useEffect` ``, `` `as` ``, `` `:has()` ``
- Property name or single-line CSS rule: `` `position: sticky` ``, `` `flex-grow: 1; flex-shrink: 1; flex-basis: 0%` ``
- One-line expression / method call / type literal: `` `xs.map(x => x * 2)` ``, `` `{ id: number; name: string }` ``
- Type keyword answers: `` `any` ``, `` `never` ``, `` `void` ``, `` `unknown` ``
- Array/object literal answers: `` `[2, 4, 6, 8]` ``, `` `{ a: 1 }` ``
- HTML element names: `` `<main>` ``, `` `<div role="main">` ``

Same rule applies when code tokens appear inline in prose. Example:

```yaml
explanation: |
  `Pick<T, K>`는 `T`에서 키 `K`만 골라낸 새 타입을 만들어요.
```

## Fenced blocks

Use a fence when:

- The content is a multi-line function, branch, or full code block
- A single line exceeds ~60 chars and would line-break awkwardly on mobile
- It's a JSX tree, multi-line object/type, or template literal

Language tag preference: `ts`, `tsx`, `js`, `jsx`, `html`, `css`. The current
renderer parses the info-string but does not use it for visual rendering, so
tags are visually inert today — still **required** so they apply automatically
when syntax highlighting (#30) ships.

```yaml
choices:
  - id: a
    text: |
      ```ts
      function area(shape: Shape) {
        return Math.PI * shape.r ** 2
      }
      ```
```

Inside YAML block scalars the fence is still recognized. Mind indentation —
match the first and last line exactly so the YAML parser doesn't trim blank
lines.

## Bold emphasis

`**…**` is for semantic emphasis only:

- `**올바른 설명**`, `**규칙 위반**`, `**컴파일 에러**`

Avoid:

- Never wrap code tokens in bold. Code = backticks.
- Surround the exponent operator `**` with spaces. The `BOLD_RE` flanking
  rule (`lib/highlight.ts:39`) won't mis-bold `Math.PI * shape.r ** 2`, but
  putting such code inside a fence is the safe path.

## `code:` field

The question's primary code sample goes in the YAML top-level `code:` field
as plain text — no backticks. The renderer wraps it in `<pre>` automatically:

```yaml
code: |
  type Shape =
    | { kind: 'circle'; r: number }
    | { kind: 'square'; s: number }
```

Backtick/fence rules only apply when you embed code inside `question:`,
`choices[].text`, or `explanation:`.

## Don't do this (failure cases)

```yaml
# ❌ function body falls into prose font; mobile wraps it randomly
choices:
  - id: a
    text: |
      function area(shape: Shape) {
        return Math.PI * shape.r ** 2
      }

# ❌ type-keyword answer with no backticks
choices:
  - id: c
    text: "any"

# ❌ CSS rule left as prose
choices:
  - id: a
    text: "label > input:checked { background: yellow }"
```

The correct form lives in the [Inline backticks](#inline-backticks) and
[Fenced blocks](#fenced-blocks) sections above.

## Automated checks

`pnpm questions:check` (wired into `prebuild`) enforces:

1. The Zod schema in `lib/question.schema.ts`
2. The prose-vs-code heuristic in `scripts/lint-question-prose.ts` —
   unwrapped code-shaped text in `question:` / `choices[].text` /
   `explanation:` exits non-zero.

### Opt-out

If the heuristic false-positives on a rare case, place an opt-out marker as
a comment on the line immediately above:

```yaml
choices:
  # fmt: off-prose
  - id: a
    text: "프로토타입 상속(prototype chain) 자체"
```

The marker applies to **the single next field** (same key block) and nothing
else. Mark each opt-out line explicitly — the goal is to keep blanket
opt-outs out of the codebase.

## Tone

Quiz copy uses a friendly Korean polite form (친근한 존댓말 — `~해요` 위주,
not `~합니다` 일변도). Detailed conversion patterns and constraints live in
`content/README.md#톤-가이드`. When editing existing content, only flip
verb endings — never change meaning, indentation, or short code-shaped
choice text.

## Reference

- Render pipeline: `lib/highlight.ts` `renderQuizMarkdown`
- Inline-text call sites: `lib/round.ts:26`, `lib/round.ts:30`, `lib/grading.ts:54`
- Lint rule: `scripts/lint-question-prose.ts`
- Bold flanking rule: `lib/highlight.ts:39` (`BOLD_RE`)
