import "server-only";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import type { Category } from "./question.schema";

const THEME = "github-dark-default";

type ShikiLang = "javascript" | "tsx" | "css" | "typescript" | "html";

const CATEGORY_TO_LANG: Record<Category, ShikiLang> = {
  javascript: "javascript",
  react: "tsx",
  css: "css",
  typescript: "typescript",
  html: "html",
};

const FENCE_LANG_ALIASES: Record<string, ShikiLang> = {
  js: "javascript",
  javascript: "javascript",
  jsx: "tsx",
  tsx: "tsx",
  ts: "typescript",
  typescript: "typescript",
  css: "css",
  html: "html",
};

let highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [import("shiki/themes/github-dark-default.mjs")],
      langs: [
        import("shiki/langs/javascript.mjs"),
        import("shiki/langs/tsx.mjs"),
        import("shiki/langs/css.mjs"),
        import("shiki/langs/typescript.mjs"),
        import("shiki/langs/html.mjs"),
      ],
      engine: createOnigurumaEngine(import("shiki/wasm")),
    });
  }
  return highlighterPromise;
}

// Shiki sets `background-color` + `color` inline on the wrapper <pre>; our
// wrapper <div> paints the background, and letting Shiki keep its own would
// double up (and force !important overrides). Token <span>s keep their inline
// color.
const SHIKI_TRANSFORMERS = [
  {
    pre(node: { properties: { style?: unknown } }) {
      node.properties.style = undefined;
    },
    code(node: { properties: { style?: unknown } }) {
      node.properties.style = undefined;
    },
  },
];

async function shikiToHtml(code: string, lang: ShikiLang): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang,
    theme: THEME,
    transformers: SHIKI_TRANSFORMERS,
  });
}

export async function highlightCode(code: string, category: Category): Promise<string> {
  return shikiToHtml(code, CATEGORY_TO_LANG[category]);
}

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
    while (runEnd < text.length && text[runEnd] === "`") runEnd++;
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
      while (k < text.length && text[k] === "`") k++;
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
// Allows the opener/closer to be indented (YAML `|` block scalars sometimes
// leave residual indent inside content). The captured code retains its own
// indentation; Shiki preserves it.
const FENCE_RE = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)\n[ \t]*```/g;

// Shared with the React result/explanation card so styling stays consistent.
// `quiz-code-block` triggers the Shiki <pre> reset in globals.css.
const FENCE_WRAPPER_CLASS =
  "quiz-code-block my-3 rounded-xl bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100";

/**
 * Render a quiz text field (question / option text / explanation) to HTML.
 *
 * - Triple-backtick fenced blocks → Shiki, wrapped in a styled <div>. The
 *   info-string (e.g. ```js, ```tsx) picks the language; if absent or
 *   unsupported, the question's `category` provides the fallback lang.
 * - Single-backtick spans → <code class="inline-code">.
 * - `**bold**` → <strong>.
 * - Everything else is HTML-escaped.
 *
 * Async because Shiki's WASM-backed highlighter is async; callers already
 * thread `await` for the question's main `code` field, so this fits the
 * same pipeline.
 */
export async function renderQuizMarkdown(text: string, category: Category): Promise<string> {
  type Fence = { start: number; end: number; lang: ShikiLang; code: string };
  const fences: Fence[] = [];
  for (const m of text.matchAll(FENCE_RE)) {
    if (m.index === undefined) continue;
    const langTag = (m[1] || "").toLowerCase();
    const lang = FENCE_LANG_ALIASES[langTag] ?? CATEGORY_TO_LANG[category];
    fences.push({
      start: m.index,
      end: m.index + m[0].length,
      lang,
      code: m[2],
    });
  }
  const fenceHtmls = await Promise.all(fences.map((f) => shikiToHtml(f.code, f.lang)));

  const parts: string[] = [];
  let cursor = 0;
  for (let i = 0; i < fences.length; i++) {
    const f = fences[i];
    if (f.start > cursor) {
      parts.push(renderInlineSegment(text.slice(cursor, f.start)));
    }
    parts.push(`<div class="${FENCE_WRAPPER_CLASS}">${fenceHtmls[i]}</div>`);
    cursor = f.end;
  }
  if (cursor < text.length) {
    parts.push(renderInlineSegment(text.slice(cursor)));
  }
  return parts.join("");
}
