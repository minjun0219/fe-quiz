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

/**
 * 코드 블록 하이라이팅 — **주석과 문자열 두 가지만** 칠한다 (#30).
 *
 * 예전에 Shiki를 걷어낸 이유는 성능이 아니라 UX였다: 풀 신택스 색이 모바일에서
 * 질문 본문보다 먼저 시선을 잡아챘다. 그래서 색을 되살리되 최소로만 둔다 —
 * 주석은 본문보다 **어둡게** 눌러 물러나게 하고, 색이 붙는 건 문자열 하나뿐이다.
 *
 * 라이브러리를 안 쓴다. 시드 전체의 코드가 11 KB(73문항 평균 149바이트)라
 * Shiki + Oniguruma WASM을 워커에 싣는 건 과하고, 두 토큰만 쓸 거면 스캐너가
 * 100줄이면 된다.
 *
 * **오탐은 색만 틀리고 텍스트는 절대 안 바뀐다.** 정규식 리터럴 안의 따옴표를
 * 문자열 시작으로 볼 수 있지만(닫는 짝을 못 찾으면 그냥 평문으로 되돌린다),
 * 어느 경로로 가든 모든 문자가 이스케이프되어 정확히 한 번 출력된다.
 * `highlight.test.ts`가 그 왕복(출력에서 태그를 걷고 엔티티를 풀면 입력과
 * 같다)을 성질로 고정한다.
 */
type CodeLang = "js" | "css" | "html";

function toCodeLang(hint: string): CodeLang {
  const h = hint.trim().toLowerCase();
  if (h === "css" || h === "scss" || h === "less") {
    return "css";
  }
  if (h === "html" || h === "markup" || h === "xml" || h === "svg") {
    return "html";
  }
  // js/ts/jsx/tsx/react + 알 수 없는 힌트. 주석·문자열 문법이 같은 무리다.
  return "js";
}

/**
 * 닫는 따옴표 **다음** 인덱스. 못 닫으면 -1 — 호출부가 평문으로 되돌린다.
 * 따옴표를 삼켜 뒤를 통째로 물들이는 게 제일 나쁜 실패라 여기서 막는다.
 */
function scanString(code: string, start: number, quote: string): number {
  const multiline = quote === "`";
  for (let i = start + 1; i < code.length; i += 1) {
    const c = code[i];
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (c === quote) {
      return i + 1;
    }
    if (!multiline && c === "\n") {
      return -1;
    }
  }
  return -1;
}

function highlightToHtml(code: string, lang: CodeLang): string {
  let out = "";
  let plainStart = 0;
  // HTML은 태그 안에서만 따옴표를 문자열로 본다 — 본문의 "don't" 같은
  // 아포스트로피가 문자열을 열어 뒤를 삼키는 걸 막는다.
  let inTag = lang !== "html";

  const flush = (end: number) => {
    if (end > plainStart) {
      out += escapeHtml(code.slice(plainStart, end));
    }
  };
  const emit = (cls: string, start: number, end: number) => {
    flush(start);
    out += `<span class="${cls}">${escapeHtml(code.slice(start, end))}</span>`;
    plainStart = end;
  };

  let i = 0;
  while (i < code.length) {
    const c = code[i];

    if (lang === "html" && code.startsWith("<!--", i)) {
      const close = code.indexOf("-->", i + 4);
      const end = close === -1 ? code.length : close + 3;
      emit("tok-c", i, end);
      i = end;
      continue;
    }
    if (lang === "js" && code.startsWith("//", i)) {
      const nl = code.indexOf("\n", i);
      const end = nl === -1 ? code.length : nl;
      emit("tok-c", i, end);
      i = end;
      continue;
    }
    if (lang !== "html" && code.startsWith("/*", i)) {
      const close = code.indexOf("*/", i + 2);
      const end = close === -1 ? code.length : close + 2;
      emit("tok-c", i, end);
      i = end;
      continue;
    }

    if (lang === "html" && (c === "<" || c === ">")) {
      inTag = c === "<";
      i += 1;
      continue;
    }

    if (inTag && (c === '"' || c === "'" || (lang === "js" && c === "`"))) {
      const end = scanString(code, i, c);
      if (end !== -1) {
        emit("tok-s", i, end);
        i = end;
        continue;
      }
    }

    i += 1;
  }
  flush(code.length);
  return out;
}

function codeBlockHtml(code: string, lang: CodeLang): string {
  return `<pre><code>${highlightToHtml(code, lang)}</code></pre>`;
}

/** 문항의 `code` 필드. 언어는 카테고리에서 고른다. */
export async function highlightCode(
  code: string,
  category: Category,
): Promise<string> {
  return codeBlockHtml(code, toCodeLang(category));
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
      `<div class="${FENCE_WRAPPER_CLASS}">${codeBlockHtml(m[2], toCodeLang(m[1] || category))}</div>`,
    );
    cursor = end;
  }
  if (cursor < text.length) {
    parts.push(renderInlineSegment(text.slice(cursor)));
  }
  return parts.join("");
}
