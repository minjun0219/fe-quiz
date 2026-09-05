import Prism from "prismjs";
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-jsx.js";
import type { Category } from "../lib/question.schema";

// 한 블록에 HTML과 CSS가 같이 든 문항이 있는데 카테고리는 하나뿐이라 lang이
// css로 잡힌다. Prism의 css 문법은 `<!-- -->`를 모르므로 주입해서 살린다.
// `<!--`가 실제 CSS에 나올 일은 없다.
Prism.languages.insertBefore("css", "comment", {
  "markup-comment": { pattern: /<!--[\s\S]*?-->/, greedy: true },
});

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * 코드 블록 하이라이팅 — 주석·문자열·키워드·숫자 넷만 칠한다 (#30).
 *
 * **빌드 타임에만 돈다.** `scripts/build-questions-json.ts`가 번들을 만들 때
 * 미리 렌더해 `questions.generated.json`에 넣고, 런타임은 그 문자열을 그대로
 * 내보낸다. 그래서 Prism은 devDependency로만 남고 워커 번들에 안 들어간다.
 * (이 파일이 `lib/`가 아니라 `scripts/`에 있는 이유다 — 위치로 못 박는다.)
 *
 * 왜 미리 칠하나: 런타임 렌더는 라운드마다 10문항 × 2회(출제·채점) 돈다.
 * 실측으로 빌드 타임이 모든 축에서 이겼다 —
 *   Prism 런타임 탑재  +9.1 KB gzip + 매 요청 토크나이즈
 *   미리 칠해 번들에    +5.0 KB gzip(코드만) / +24~30 KB(전체), 런타임 0
 *
 * 팔레트를 넷으로 제한하는 이유는 예전에 풀 신택스 색이 모바일에서 질문
 * 본문보다 먼저 시선을 잡아채서 걷어냈기 때문이다. Prism은 모든 토큰에 span을
 * 다는데, 우리가 안 칠하는 것까지 실으면 HTML이 10.8배로 부푼다 — 4종만
 * 남기면 3.1배다. 그래서 `TOKEN_CLASS`에 없는 토큰은 span 없이 텍스트만 낸다.
 */
type CodeLang = "markup" | "css" | "javascript" | "typescript" | "jsx";

const CATEGORY_LANG: Record<string, CodeLang> = {
  css: "css",
  html: "markup",
  javascript: "javascript",
  typescript: "typescript",
  react: "jsx",
  nextjs: "jsx",
  browser: "javascript",
  performance: "javascript",
};

const FENCE_LANG: Record<string, CodeLang> = {
  css: "css",
  scss: "css",
  less: "css",
  html: "markup",
  markup: "markup",
  xml: "markup",
  svg: "markup",
  js: "javascript",
  javascript: "javascript",
  ts: "typescript",
  typescript: "typescript",
  jsx: "jsx",
  tsx: "jsx",
};

/** Prism 토큰 타입 → 우리 4색. 여기 없는 토큰은 span을 안 단다. */
const TOKEN_CLASS: Record<string, string> = {
  comment: "tok-c",
  "markup-comment": "tok-c",
  prolog: "tok-c",
  doctype: "tok-c",
  cdata: "tok-c",
  string: "tok-s",
  "template-string": "tok-s",
  "attr-value": "tok-s",
  char: "tok-s",
  keyword: "tok-k",
  tag: "tok-k",
  property: "tok-k",
  // `atrule`은 `@media (min-width: 40rem)` 전체를 감싼다 — 그 안의 `rule`만
  // 잡아 `@media`만 칠한다. `selector`는 일부러 뺐다: 선택자까지 칠하면 CSS
  // 블록이 통째로 물들어 "구조만 보이게" 하려던 의도가 사라진다.
  rule: "tok-k",
  number: "tok-n",
  boolean: "tok-n",
};

type PrismToken = string | { type: string; content: PrismToken | PrismToken[] };

/**
 * `parentClass`는 같은 클래스가 겹쳐 붙는 걸 막는다 — Prism은 문자열 토큰 안에
 * 또 문자열 토큰을 두기도 해서, 그대로 두면 `<span class="tok-s">`가 이중으로
 * 나가고 부피만 는다.
 */
function renderTokens(tokens: PrismToken[], parentClass?: string): string {
  let out = "";
  for (const t of tokens) {
    if (typeof t === "string") {
      out += escapeHtml(t);
      continue;
    }
    const cls = TOKEN_CLASS[t.type];
    const effective = cls ?? parentClass;
    const content = Array.isArray(t.content) ? t.content : [t.content];
    const inner = renderTokens(content, effective);
    out +=
      cls && cls !== parentClass
        ? `<span class="${cls}">${inner}</span>`
        : inner;
  }
  return out;
}

function codeBlockHtml(code: string, lang: CodeLang): string {
  const grammar = Prism.languages[lang] ?? Prism.languages.javascript;
  return `<pre><code>${renderTokens(
    Prism.tokenize(code, grammar) as PrismToken[],
  )}</code></pre>`;
}

/** 문항의 `code` 필드. 언어는 카테고리에서 고른다. */
export async function highlightCode(
  code: string,
  category: Category,
): Promise<string> {
  return codeBlockHtml(code, CATEGORY_LANG[category] ?? "javascript");
}

// Single-line **bold** runs. Inner content starts and ends with non-whitespace
// (CommonMark-style flanking rule), can't span a newline, and can't contain a
// literal `*` — so `** 2 ** 3` (TS exponent operators with surrounding spaces),
// `****`, and `**a*b**` all pass through untouched. Applied AFTER HTML escaping
// — `*` is not escaped, so the asterisk positions are preserved and the inner
// text is already safe.
const BOLD_RE = /\*\*(\S(?:[^*\n]*?\S)?)\*\*/g;

function escapeAndFormat(s: string): string {
  return escapeHtml(s).replace(BOLD_RE, "<strong>$1</strong>");
}

/**
 * Inline pass: renders a non-fenced text segment to HTML.
 *
 * Wraps `` `...` `` runs in <code class="inline-code"> — single-line only,
 * a backtick followed by a newline before its closer is treated as literal.
 * Multi-backtick runs (`` ``` `` openers without a matching close) pass
 * through literally so a malformed fence doesn't get mangled into an empty
 * <code> tag. Outside backtick spans, `**bold**` runs are wrapped in
 * <strong>; everything else is HTML-escaped.
 */
function renderInlineSegment(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const tick = text.indexOf("`", i);
    if (tick === -1) {
      out += escapeAndFormat(text.slice(i));
      break;
    }
    out += escapeAndFormat(text.slice(i, tick));

    let runEnd = tick;
    while (runEnd < text.length && text[runEnd] === "`") {
      runEnd++;
    }
    const openLen = runEnd - tick;

    if (openLen !== 1) {
      // ``` / `` etc — emit literally; do not pair-match. Closed fences are
      // already extracted by `renderQuizMarkdown` before this pass runs.
      out += "`".repeat(openLen);
      i = runEnd;
      continue;
    }

    // Single-backtick opener: look for a single-backtick closer on the same
    // line. Skip past any multi-backtick runs encountered in between.
    let scan = runEnd;
    let closeStart = -1;
    while (scan < text.length && text[scan] !== "\n") {
      if (text[scan] !== "`") {
        scan++;
        continue;
      }
      let k = scan;
      while (k < text.length && text[k] === "`") {
        k++;
      }
      if (k - scan === 1) {
        closeStart = scan;
        break;
      }
      scan = k;
    }

    if (closeStart === -1) {
      out += "`";
      i = runEnd;
      continue;
    }

    out += `<code class="inline-code">${escapeHtml(text.slice(runEnd, closeStart))}</code>`;
    i = closeStart + 1;
  }
  return out;
}

// Fenced code block: ```<lang>\n<code>\n``` — non-greedy across newlines.
// info-string이 있으면 그걸, 없으면 문항 카테고리를 언어로 쓴다.
const FENCE_RE = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)\n[ \t]*```/g;

// Shared with the React result/explanation card so styling stays consistent.
// Fenced blocks inside markdown (questions / explanations / choices) default
// to wrap (`whitespace-pre-wrap`) to match `<CodeBlock>`'s mobile-readable
// default. The toggle (wrap ↔ scroll) only lives on the dedicated `<CodeBlock>`
// for a question's `code` field; fenced blocks remain wrap-only.
const FENCE_WRAPPER_CLASS =
  "quiz-code-block my-3 rounded-xl bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100 ring-1 ring-inset ring-white/5 whitespace-pre-wrap break-words [&_pre]:whitespace-pre-wrap [&_pre]:break-words";

/**
 * Render a quiz text field (question / option text / explanation) to HTML.
 *
 * - Triple-backtick fenced blocks → escaped <pre><code> wrapped in a styled
 *   dark <div>. 주석·문자열만 칠한다 (#30) — info-string이 언어를 정한다.
 * - Single-backtick spans → <code class="inline-code">.
 * - `**bold**` → <strong>.
 * - Everything else is HTML-escaped.
 *
 * Async (returns Promise) so callers can wire it into the same Promise.all
 * pipeline used by the rest of the render path; if highlighting (#30) comes
 * back, the signature already accommodates an async highlighter.
 */
export async function renderQuizMarkdown(
  text: string,
  category: Category,
): Promise<string> {
  const parts: string[] = [];
  let cursor = 0;
  for (const m of text.matchAll(FENCE_RE)) {
    if (m.index === undefined) {
      continue;
    }
    const start = m.index;
    const end = start + m[0].length;
    if (start > cursor) {
      parts.push(renderInlineSegment(text.slice(cursor, start)));
    }
    parts.push(
      `<div class="${FENCE_WRAPPER_CLASS}">${codeBlockHtml(m[2], FENCE_LANG[m[1].toLowerCase()] ?? CATEGORY_LANG[category] ?? "javascript")}</div>`,
    );
    cursor = end;
  }
  if (cursor < text.length) {
    parts.push(renderInlineSegment(text.slice(cursor)));
  }
  return parts.join("");
}
