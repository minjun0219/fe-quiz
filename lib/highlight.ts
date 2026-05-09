import "server-only";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import type { Category } from "./question.schema";

const THEME = "github-dark-default";

const CATEGORY_TO_LANG: Record<Category, "javascript" | "tsx" | "css"> = {
  javascript: "javascript",
  react: "tsx",
  css: "css",
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
 * Everything outside the runs is HTML-escaped; matched inner text is too.
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
    const end = text.indexOf("`", tick + 1);
    const newlineBefore = text.indexOf("\n", tick + 1);
    if (end === -1 || (newlineBefore !== -1 && newlineBefore < end)) {
      out += escapeHtml(text.slice(i, tick + 1));
      i = tick + 1;
      continue;
    }
    out += escapeHtml(text.slice(i, tick));
    out += `<code class="inline-code">${escapeHtml(text.slice(tick + 1, end))}</code>`;
    i = end + 1;
  }
  return out;
}
