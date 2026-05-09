/**
 * Raw-text linter for `content/questions/**\/*.yaml`.
 *
 * Why a separate pass (not the Zod schema in `lib/question.schema.ts`):
 *   1) the YAML parser strips comments, but we need them for the
 *      `# fmt: off-prose` opt-out marker;
 *   2) `loadAllQuestions` is reused at request time in `lib/round.ts` — the
 *      loader stays pure; this lint runs only from `scripts/check-questions.ts`.
 *
 * Heuristic: in `question:` / `choices[].text` / `explanation:` values, strip
 * everything already wrapped in inline backticks or fenced ``` blocks, then
 * flag the remainder if it still looks like code. False-positives are silenced
 * with `# fmt: off-prose` on the line directly above the offending field.
 *
 * See `docs/CONTENT_STYLE.md` for the convention this enforces.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type LintHit = {
  file: string;
  line: number;
  field: string;
  reason: string;
  excerpt: string;
};

const OFF_MARKER = "# fmt: off-prose";

const FIELD_KEYS = ["question", "explanation", "text"] as const;

type Field = (typeof FIELD_KEYS)[number];

type ExtractedValue = {
  field: Field;
  // Line where the field declaration starts (`text: …` / `text: |`). Used for
  // both opt-out lookup and hit reporting so authors land on the line they
  // need to edit.
  keyLine: number;
  text: string;
};

function indentOf(line: string): number {
  let n = 0;
  while (n < line.length && line[n] === " ") {
    n++;
  }
  return n;
}

function unquoteScalar(raw: string): string {
  if (raw.length >= 2) {
    const first = raw[0];
    const last = raw[raw.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const inner = raw.slice(1, -1);
      if (first === '"') {
        return inner.replace(/\\(["\\nrt])/g, (_, c) => {
          if (c === "n") {
            return "\n";
          }
          if (c === "r") {
            return "\r";
          }
          if (c === "t") {
            return "\t";
          }
          return c;
        });
      }
      return inner;
    }
  }
  return raw;
}

/**
 * Walk a YAML file and yield each (field, value) pair we care about. Handles
 * both inline `key: "..."` and block-scalar `key: |` forms. Comments and other
 * keys are skipped.
 */
function extractFieldValues(source: string): ExtractedValue[] {
  const lines = source.split("\n");
  const out: ExtractedValue[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Trailing ` # comment` (with leading space) is dropped so the value
    // capture stays clean. The leading space is required so values like
    // `"#fff"` (CSS hex) and `` `#fff` `` aren't truncated mid-token.
    const m = line.match(
      /^(\s*)(?:- \s*)?([a-zA-Z_]+):\s*(.*?)\s*(?:\s+#.*)?$/,
    );
    if (!m) {
      i++;
      continue;
    }
    const [, , key, rest] = m;
    if (!FIELD_KEYS.includes(key as Field)) {
      i++;
      continue;
    }
    const field = key as Field;
    const keyIndent = indentOf(line);

    if (rest === "|" || rest === ">" || rest === "|-" || rest === ">-") {
      // Block scalar: collect indented continuation lines.
      const blockStart = i + 1;
      const childIndent =
        blockStart < lines.length && lines[blockStart].length > 0
          ? indentOf(lines[blockStart])
          : keyIndent + 2;
      const collected: string[] = [];
      let j = blockStart;
      while (j < lines.length) {
        const cur = lines[j];
        if (cur.trim() === "") {
          collected.push("");
          j++;
          continue;
        }
        if (indentOf(cur) < childIndent) {
          break;
        }
        collected.push(cur.slice(childIndent));
        j++;
      }
      out.push({
        field,
        keyLine: i + 1,
        text: collected.join("\n").replace(/\n+$/, ""),
      });
      i = j;
      continue;
    }

    if (rest.length === 0) {
      i++;
      continue;
    }

    out.push({
      field,
      keyLine: i + 1,
      text: unquoteScalar(rest),
    });
    i++;
  }

  return out;
}

/**
 * Find a `# fmt: off-prose` marker for the field declared on `keyLine`
 * (1-indexed). The marker may sit:
 *   - directly above the field key (`text:` / `question:` / `explanation:`),
 *   - above the choice item (`- id: …`) so it covers all of that item's
 *     fields, or
 *   - separated from the key by an empty line.
 *
 * Walks upward past YAML wrapper lines (key-value pairs like `id: a`,
 * list-item headers like `- id: a`) until it either lands on the marker
 * or hits a non-wrapper line. Capped at a small number of hops so a
 * marker far up the file can't accidentally apply.
 */
function hasOptOut(source: string, keyLine: number): boolean {
  const lines = source.split("\n");
  let cursor = keyLine - 2;
  let hops = 0;
  const MAX_HOPS = 4;
  while (cursor >= 0 && hops <= MAX_HOPS) {
    const trimmed = lines[cursor].trim();
    if (trimmed === "") {
      cursor--;
      continue;
    }
    if (trimmed === OFF_MARKER) {
      return true;
    }
    if (isYamlWrapperLine(trimmed)) {
      cursor--;
      hops++;
      continue;
    }
    return false;
  }
  return false;
}

function isYamlWrapperLine(trimmed: string): boolean {
  // Block-scalar opener: `text: |`, `text: >-`, etc.
  if (/^[a-zA-Z_][\w-]*:\s*[|>][-+]?\s*$/.test(trimmed)) {
    return true;
  }
  // `- id: a` list-item with key.
  if (/^-\s+[a-zA-Z_][\w-]*:\s*\S/.test(trimmed)) {
    return true;
  }
  // Plain `key: value` (e.g. `id: a`, `category: react`).
  if (/^[a-zA-Z_][\w-]*:\s*\S/.test(trimmed)) {
    return true;
  }
  // Bare dash line introducing a sequence item on its own.
  if (trimmed === "-") {
    return true;
  }
  return false;
}

/**
 * Strip text spans that are already wrapped in inline single-backticks or
 * fenced ``` blocks. What remains is what the heuristic gets to inspect.
 */
function stripWrappedSpans(text: string): string {
  // Remove fenced blocks first (greedy across lines, non-greedy body).
  const fenceStripped = text.replace(
    /```[a-zA-Z0-9_+-]*\n[\s\S]*?\n[ \t]*```/g,
    " ",
  );
  // Then inline single-backtick spans on a single line.
  return fenceStripped.replace(/`[^`\n]+`/g, " ");
}

const CODE_PATTERNS: { name: string; re: RegExp }[] = [
  // Korean prose uses `=>` to mean "implies/then", so requiring an arg list
  // (parens or a single bare identifier) immediately before keeps prose like
  // "A 클릭 => B 발생" out of the hits.
  {
    name: "arrow function (=>)",
    re: /(?:\([^)\n]*\)|[A-Za-z_$][\w$]*)\s*=>/,
  },
  {
    name: "function/return/const/let/var keyword",
    re: /\b(?:function|return|const|let|var)\s+[A-Za-z_$]/,
  },
  { name: "strict equality (===/!==)", re: /===|!==/ },
  { name: "template literal interpolation (${)", re: /\$\{/ },
  // The negative lookahead `(?!\.)` rejects abbreviations like `e.g. (`
  // and `i.e. (` where the second segment is itself followed by a period.
  // Real method calls (`xs.push(`, `Math.PI(`, `Node.js(`) still match.
  {
    name: "method call (ident.ident(...))",
    re: /[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*(?!\.)\s*\(/,
  },
  { name: "JSX-like tag", re: /<\/?[A-Za-z][\w-]*[\s/>]/ },
  // Require ≥2 `prop: value;` declarations so a single Korean line like
  // `참고: 이렇다;` doesn't trigger. Real CSS shorthand answers in this
  // codebase always have multiple declarations.
  {
    name: "CSS shorthand (prop: value; prop: value)",
    re: /[a-z][a-z-]+\s*:\s*[^;\n]+;\s*[a-z][a-z-]+\s*:\s*[^;\n]+/,
  },
  { name: "TS type literal answer", re: /^\s*\{[^}\n]*:[^}\n]*\}\s*$/m },
  {
    name: "bare TS type-keyword answer",
    re: /^(?:any|never|void|unknown|string|number|boolean|null|undefined)$/,
  },
  { name: "array literal answer", re: /^\s*\[[^\]\n]*\]\s*$/m },
  {
    name: "TS string literal union",
    re: /^\s*['"][^'"\n]+['"](?:\s*\|\s*['"][^'"\n]+['"])+\s*$/m,
  },
];

function detectCodeShape(stripped: string): string | null {
  const trimmed = stripped.trim();
  if (trimmed.length === 0) {
    return null;
  }
  for (const { name, re } of CODE_PATTERNS) {
    if (re.test(trimmed)) {
      return name;
    }
  }
  return null;
}

function lintFile(absPath: string, relPath: string): LintHit[] {
  const source = readFileSync(absPath, "utf8");
  const values = extractFieldValues(source);
  const hits: LintHit[] = [];

  for (const v of values) {
    if (hasOptOut(source, v.keyLine)) {
      continue;
    }
    const stripped = stripWrappedSpans(v.text);
    const reason = detectCodeShape(stripped);
    if (!reason) {
      continue;
    }
    hits.push({
      file: relPath,
      line: v.keyLine,
      field: v.field,
      reason,
      excerpt: v.text.length > 80 ? `${v.text.slice(0, 77)}...` : v.text,
    });
  }
  return hits;
}

export function lintQuestionProse(rootDir: string): LintHit[] {
  const hits: LintHit[] = [];
  const categories = readdirSync(rootDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const category of categories) {
    const dir = join(rootDir, category);
    const entries = readdirSync(dir, { withFileTypes: true }).filter(
      (e) => e.isFile() && e.name.endsWith(".yaml"),
    );
    for (const entry of entries) {
      const relPath = `${category}/${entry.name}`;
      hits.push(...lintFile(join(dir, entry.name), relPath));
    }
  }
  return hits;
}

export function formatHits(hits: LintHit[]): string {
  return hits
    .map(
      (h) =>
        `  ${h.file}:${h.line}  [${h.field}] ${h.reason}\n    "${h.excerpt.replace(/\n/g, "\\n")}"`,
    )
    .join("\n");
}
