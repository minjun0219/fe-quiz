/**
 * Pre-build the per-category prompts for the daily generation workflow.
 *
 * Why this is a script (not inside the sub-agent):
 *   - id assignment, slug collision detection, and index excerpts are
 *     deterministic. Doing them in the script keeps `quiz-author` from
 *     having to read schema/AGENTS.md/INDEX.md through tool round-trips,
 *     which would inflate token cost.
 *   - the same prompt artifact is reusable for local dry runs
 *     (`pnpm questions:prepare-batch react,css,html` then inspect
 *     `.cache/batch.json`).
 *
 * Output: `.cache/batch.json` — an array of `{category, difficulty, next_id,
 * slug_blocklist, system_prompt, user_prompt}`. The orchestrator slash command
 * reads this file and spawns one `quiz-author` Task per entry.
 *
 * Args: `<cat1,cat2,...> [<diff1,diff2,...>]` — categories required,
 * difficulties default to `easy,medium,hard` cycled to match category count.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CATEGORIES, getIdPrefix } from "../lib/categories";
import { loadAllQuestions } from "../lib/load-questions";
import type { Category, Difficulty } from "../lib/question.schema";

const ROOT = join(process.cwd(), "content/questions");
const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));
const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];
const DEFAULT_DIFFICULTIES = "easy,medium,hard";

function parseCsv<T extends string>(
  raw: string,
  validate: (v: string) => v is T,
  label: string,
): T[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`${label}: empty list`);
  }
  for (const p of parts) {
    if (!validate(p)) {
      throw new Error(`${label}: invalid value "${p}"`);
    }
  }
  return parts as T[];
}

function isCategory(v: string): v is Category {
  return CATEGORY_IDS.has(v as Category);
}

function isDifficulty(v: string): v is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(v);
}

function readUtf8(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function extractSchemaExcerpt(): string {
  const src = readUtf8("lib/question.schema.ts");
  const start = src.indexOf("export const ChoiceSchema");
  const end = src.indexOf("export type Question = z.infer");
  if (start < 0 || end < 0) {
    throw new Error(
      "lib/question.schema.ts shape changed — update prepare-batch.ts excerpt anchors",
    );
  }
  return src.slice(start, end).trimEnd();
}

function buildIndexExcerpt(category: Category): {
  block: string;
  slugBlocklist: string[];
} {
  const all = loadAllQuestions(ROOT).filter((q) => q.category === category);
  all.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));

  const slugBlocklist = all.map((q) => slugFromFilename(q.id));
  const lines = all.map((q) => {
    const tags = q.tags.length > 0 ? ` (${q.tags.join(", ")})` : "";
    const preview = q.question.replace(/\s+/g, " ").trim().slice(0, 100);
    return `- ${q.id} [${q.difficulty}]${tags}: ${preview}`;
  });
  return { block: lines.join("\n"), slugBlocklist };
}

/** Best-effort guess at the slug from an existing id; only used for blocklist hints. */
function slugFromFilename(id: string): string {
  // We can't recover the filename slug from the id alone; the blocklist is
  // advisory ("avoid these themes"), so derive a token from tags or the id.
  return id;
}

function nextIdFor(
  category: Category,
  ids: string[],
): {
  next_id: string;
  next_num: number;
} {
  const prefix = getIdPrefix(category);
  let maxNum = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of ids) {
    const m = id.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n > maxNum) {
        maxNum = n;
      }
    }
  }
  const next = maxNum + 1;
  const padded = String(next).padStart(3, "0");
  return { next_id: `${prefix}-${padded}`, next_num: next };
}

function buildSystemPrompt(args: {
  category: Category;
  difficulty: Difficulty;
  next_id: string;
  schemaExcerpt: string;
  proseConvention: string;
}): string {
  return [
    "# 역할",
    "너는 프론트엔드 학습 퀴즈를 한국어로 출제하는 작가다. 너의 출력은 단 하나의 JSON 객체이며, 그 외의 텍스트(머리말·설명·코드 펜스·마크다운)는 절대 출력하지 않는다.",
    "",
    "# 출력 계약",
    "응답은 정확히 다음 키만 가진 JSON 1개:",
    "```",
    "{",
    '  "slug": "lowercase-kebab-1-to-40-chars",   // 파일명에 들어갈 슬러그',
    '  "type": "single_choice" | "multi_choice",',
    '  "question": "문제 본문 (한국어, ~해요 톤)",',
    '  "code": "선택 — 본문에 곁들일 코드 (백틱 없이 plain text)",',
    '  "choices": [ { "id": "a", "text": "..." }, ... ],   // 2~6개',
    '  "answer": "a"   // single_choice면 문자열, multi_choice면 ["a","c"] 식 배열. 반드시 choices의 id 중 하나(들)',
    '  "explanation": "왜 그 답인지 한국어 설명 (~해요 톤)",',
    '  "references": [ { "title": "...", "url": "https://..." } ],   // 1~5개. https:// 필수.',
    '  "tags": ["kebab-tag", "..."]   // 1~6개 권장',
    "}",
    "",
    "절대 다른 키를 추가하지 말고, 위 키 중 일부도 빠뜨리지 말 것(`code`만 선택).",
    "응답은 위 객체로 시작해서 객체로 끝난다. 마크다운 펜스(```)·머리말·뒷말 금지.",
    "",
    "# 메타 (이미 결정됨 — 본문에 포함시키지 말고 응답 키도 만들지 마라)",
    `- 카테고리: ${args.category}`,
    `- 난이도: ${args.difficulty}`,
    `- 부여될 id: ${args.next_id} (스크립트가 자동 주입)`,
    "",
    "# Zod 스키마 (lib/question.schema.ts에서 발췌 — 모두 만족시켜야 한다)",
    "```ts",
    args.schemaExcerpt,
    "```",
    "",
    "추가 규칙:",
    "- `choices`는 2~6개. `choices[].id`는 짧은 소문자/숫자/`_`/`-`만, 중복 금지. 관례적으로 `a,b,c,d`.",
    "- `choices[].text`는 모두 서로 다른 텍스트. 정답이 명백히 길거나 길이로 추측되지 않게.",
    "- `multi_choice`라면 정답이 1개 이상이지만 **전부 정답은 금지** (오답이 최소 1개 있어야 한다).",
    "- `answer`는 `choices[].id` 중 하나(들)와 정확히 일치해야 한다 (인덱스가 아님).",
    "- `references[].url`은 반드시 `https://`로 시작. 빈 배열 금지.",
    "",
    "# 콘텐츠 컨벤션 (content/AGENTS.md 발췌)",
    args.proseConvention,
    "",
    "# 톤",
    "- 친근한 존댓말 `~해요` 위주. `~합니다` 일변도 금지. 친구한테 설명하듯 가볍게.",
    "- 그러나 사양·정의의 정확성은 깎지 말 것. 모호하면 차라리 보수적으로.",
    "",
    "# 안전 규칙",
    "- 본문/해설에 정답을 그대로 베껴 적지 말 것. 추론이 필요한 문제로.",
    "- 폐기/옛 API에 기반한 문제는 만들지 마라(React legacy, var-only JS 등).",
    '- 사양에서 확정된 동작만 다룬다. "브라우저마다 다르다" 같은 비결정적 문제 금지.',
    "- 출처는 공식 문서/사양 우선: MDN, react.dev, nextjs.org, W3C/WHATWG.",
  ].join("\n");
}

function buildUserPrompt(args: {
  category: Category;
  difficulty: Difficulty;
  next_id: string;
  indexExcerpt: string;
}): string {
  return [
    `카테고리 \`${args.category}\` 에서 난이도 \`${args.difficulty}\` 의 새 문제 1개를 출제해 주세요.`,
    `id는 \`${args.next_id}\` 가 자동 부여될 예정이니, 응답 JSON에는 \`id\` 키를 넣지 마세요.`,
    "",
    "## 기존 문제 카탈로그 (이 카테고리)",
    "다음 문제들과 **주제·tags·코드 패턴이 겹치지 않게** 다른 각도로 출제해 주세요:",
    "",
    args.indexExcerpt || "_(아직 이 카테고리에 등록된 문제 없음)_",
    "",
    "## 출력",
    "위에서 정의한 JSON 스키마에 맞춰 단일 객체로만 응답해 주세요.",
  ].join("\n");
}

function main() {
  const [catsArg, diffsArg] = process.argv.slice(2);
  if (!catsArg) {
    console.error(
      "Usage: tsx scripts/prepare-batch.ts <cat1,cat2,...> [<diff1,diff2,...>]",
    );
    process.exit(1);
  }

  const categories = parseCsv(catsArg, isCategory, "categories");
  const difficulties = parseCsv(
    diffsArg ?? DEFAULT_DIFFICULTIES,
    isDifficulty,
    "difficulties",
  );

  const allIds = loadAllQuestions(ROOT).map((q) => q.id);
  const schemaExcerpt = extractSchemaExcerpt();
  const proseConvention = readUtf8("content/AGENTS.md");

  const batch = categories.map((category, i) => {
    const difficulty = difficulties[i % difficulties.length];
    const { next_id } = nextIdFor(category, allIds);
    const { block, slugBlocklist } = buildIndexExcerpt(category);
    return {
      category,
      difficulty,
      next_id,
      slug_blocklist: slugBlocklist,
      system_prompt: buildSystemPrompt({
        category,
        difficulty,
        next_id,
        schemaExcerpt,
        proseConvention,
      }),
      user_prompt: buildUserPrompt({
        category,
        difficulty,
        next_id,
        indexExcerpt: block,
      }),
    };
  });

  const outPath = join(process.cwd(), ".cache/batch.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(batch, null, 2)}\n`);
  console.log(`✓ wrote ${outPath} (${batch.length} entries)`);
  for (const item of batch) {
    console.log(`  - ${item.category} / ${item.difficulty} → ${item.next_id}`);
  }
}

main();
