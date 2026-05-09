import "server-only";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import type { Category } from "./question.schema";

const THEME = "github-dark-default";

const CATEGORY_TO_LANG: Record<Category, "javascript" | "tsx" | "css" | "typescript" | "html"> = {
  javascript: "javascript",
  react: "tsx",
  css: "css",
  typescript: "typescript",
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

export async function highlightCode(code: string, category: Category): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang: CATEGORY_TO_LANG[category],
    theme: THEME,
    transformers: [
      {
        // Shiki sets `background-color` + `color` inline on the wrapper <pre>;
        // our wrapper <div> already paints the background via Tailwind, and
        // letting Shiki keep its own would double up (and force !important
        // overrides). Token <span>s keep their inline color.
        pre(node) {
          delete node.properties.style;
        },
        code(node) {
          delete node.properties.style;
        },
      },
    ],
  });
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

/**
 * Wrap `` `...` `` runs in <code class="inline-code">. Single-line only —
 * a backtick followed by a newline before its closer is treated as literal.
 * Multi-backtick runs (`` ``` `` fence openers, `` `` ``-delimited spans)
 * are passed through literally so fenced blocks in explanations don't get
 * mangled into empty <code> tags.
 * Everything outside wrapped spans is HTML-escaped; matched inner text is too.
 */
export function highlightInlineBackticks(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const tick = text.indexOf("`", i);
    if (tick === -1) {
      out += escapeHtml(text.slice(i));
      break;
    }
    out += escapeHtml(text.slice(i, tick));

    let runEnd = tick;
    while (runEnd < text.length && text[runEnd] === "`") runEnd++;
    const openLen = runEnd - tick;

    if (openLen !== 1) {
      // ``` / `` etc — emit literally; do not pair-match.
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
