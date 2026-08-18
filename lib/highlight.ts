import type { Category } from "./question.schema";

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

// Plain monospace block — no syntax coloring. The wrapping <div> in the JSX
// caller paints the dark background + padding (see RoundRunner / Result), so
// here we only need an HTML-escaped <pre><code>. Tracked as backlog #30 if we
// want token-level highlighting back.
function plainCodeBlock(code: string): string {
  return `<pre><code>${escapeHtml(code)}</code></pre>`;
}

// `category` was the Shiki language key; kept on the signature so callers
// don't need to change when/if highlighting comes back via #30.
export async function highlightCode(
  code: string,
  _category: Category,
): Promise<string> {
  return plainCodeBlock(code);
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
// The info-string is parsed but ignored (no syntax highlighting); see #30.
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
 *   dark <div>. Info-string is currently ignored (see backlog #30).
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
  _category: Category,
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
      `<div class="${FENCE_WRAPPER_CLASS}">${plainCodeBlock(m[2])}</div>`,
    );
    cursor = end;
  }
  if (cursor < text.length) {
    parts.push(renderInlineSegment(text.slice(cursor)));
  }
  return parts.join("");
}
