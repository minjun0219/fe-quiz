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
 * 코드 블록 하이라이팅 — 주석·문자열·키워드·숫자 넷만 칠한다 (#30).
 *
 * 예전에 Shiki를 걷어낸 이유는 성능이 아니라 UX였다: 풀 신택스 색이 모바일에서
 * 질문 본문보다 먼저 시선을 잡아챘다. 그래서 색을 되살리되 최소로만 둔다 —
 * 주석은 본문보다 **어둡게** 눌러 물러나게 하고, 색은 문자열·키워드·숫자에만
 * 붙인다. 식별자·함수명·타입명은 일부러 뺐다 — 거기까지 칠하면 화면 절반이
 * 색이 되어 원래 걷어냈던 상태로 돌아간다.
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

// JS/TS/JSX 공통. 값(`true`/`null`)까지 넣은 건 키워드와 같은 무게로 읽히기
// 때문이다. 식별자·함수명·타입명은 일부러 뺐다 — 거기까지 칠하면 화면 절반이
// 색이 되어 #30이 걷어냈던 상태로 돌아간다.
const JS_KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "get",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "keyof",
  "let",
  "new",
  "null",
  "of",
  "readonly",
  "return",
  "satisfies",
  "set",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "yield",
]);

const WORD_RE = /[A-Za-z_$][\w$]*/y;
const NUMBER_RE =
  /(?:0[xXbBoO][\da-fA-F_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?)n?/y;
// CSS 속성명 후보: `word-word :` 형태. 깊이만으로는 부족하다 —
// `@media { a:hover { … } }`처럼 중첩되면 선택자도 깊이 1이라 `a`가 속성으로
// 잡힌다. `:` 뒤를 훑어 `{`가 먼저 나오면 선택자로 보고 넘긴다
// (`isDeclaration` 참고).
const CSS_PROP_RE = /-{0,2}[a-zA-Z][\w-]*(?=\s*:)/y;
// HTML 태그명: `<` 또는 `</` 바로 뒤.
const HTML_TAG_RE = /\/?[a-zA-Z][\w:-]*/y;

/**
 * `:` 뒤가 선언(`color: red;`)인지 선택자(`a:hover {`)인지.
 * `;`나 `}`가 먼저 오면 선언, `{`가 먼저 오면 선택자다.
 */
function isDeclaration(code: string, colonAt: number): boolean {
  for (let i = colonAt + 1; i < code.length; i += 1) {
    const c = code[i];
    if (c === "{") {
      return false;
    }
    if (c === ";" || c === "}") {
      return true;
    }
  }
  return true;
}

function matchAt(re: RegExp, code: string, i: number): string | null {
  re.lastIndex = i;
  const m = re.exec(code);
  return m ? m[0] : null;
}

function highlightToHtml(code: string, lang: CodeLang): string {
  let out = "";
  let plainStart = 0;
  // HTML은 태그 안에서만 따옴표를 문자열로 본다 — 본문의 "don't" 같은
  // 아포스트로피가 문자열을 열어 뒤를 삼키는 걸 막는다.
  let inTag = lang !== "html";
  let justOpenedTag = false;
  let depth = 0;

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

    // `<!--`는 언어를 안 가린다. 한 블록에 HTML과 CSS가 같이 든 문항이 있는데
    // (카테고리는 하나뿐이라 lang이 css로 잡힌다) 그때 HTML 주석이 안 눌린다.
    // `<!--`가 JS·CSS 코드에 나올 일이 없어서 전 언어에서 인식해도 안전하다.
    if (code.startsWith("<!--", i)) {
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
      justOpenedTag = inTag;
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

    if (lang === "html" && justOpenedTag) {
      justOpenedTag = false;
      const tag = matchAt(HTML_TAG_RE, code, i);
      if (tag) {
        emit("tok-k", i, i + tag.length);
        i += tag.length;
        continue;
      }
    }

    if (lang === "js") {
      const word = matchAt(WORD_RE, code, i);
      if (word) {
        if (JS_KEYWORDS.has(word)) {
          emit("tok-k", i, i + word.length);
        }
        // 키워드가 아니어도 통째로 건너뛴다 — 식별자 안의 부분 문자열이
        // 키워드로 잡히는 걸 막는다(`constant`의 `const` 등).
        i += word.length;
        continue;
      }
      const num = matchAt(NUMBER_RE, code, i);
      if (num) {
        emit("tok-n", i, i + num.length);
        i += num.length;
        continue;
      }
    }

    if (lang === "css") {
      if (c === "{") {
        depth += 1;
        i += 1;
        continue;
      }
      if (c === "}") {
        depth = Math.max(0, depth - 1);
        i += 1;
        continue;
      }
      if (c === "@") {
        const at = matchAt(WORD_RE, code, i + 1);
        if (at) {
          emit("tok-k", i, i + 1 + at.length);
          i += 1 + at.length;
          continue;
        }
      }
      if (depth > 0) {
        const prop = matchAt(CSS_PROP_RE, code, i);
        if (prop) {
          const colonAt = code.indexOf(":", i + prop.length);
          if (colonAt !== -1 && isDeclaration(code, colonAt)) {
            emit("tok-k", i, i + prop.length);
            i += prop.length;
            continue;
          }
        }
        const num = matchAt(NUMBER_RE, code, i);
        if (num) {
          emit("tok-n", i, i + num.length);
          i += num.length;
          continue;
        }
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
