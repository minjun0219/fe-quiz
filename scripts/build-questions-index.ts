/**
 * Build `content/INDEX.md` — a flat catalog of every question in the tree.
 *
 * Why this exists:
 *   - the daily-generation workflow feeds the new-question author a list of
 *     existing questions so it picks fresh topics. Re-reading every YAML in
 *     the action would burn tokens (~250 files of multi-line code blocks);
 *     this catalog gives the same coverage in ~50 lines per category.
 *   - human reviewers get a single page to skim what's already covered before
 *     approving a generated PR.
 *
 * What this file deliberately does NOT include: `answer`, `explanation`,
 * `choices`, `references`. A reviewer (or a future generator that reads
 * this index) must never see the correct answer before grading.
 *
 * Modes:
 *   - default (`pnpm questions:index`): writes the file.
 *   - `--check` (`pnpm questions:index:check`): builds in memory, diffs
 *     against disk, exits 1 if stale. Wired into `prebuild`/`check`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES } from "../lib/categories";
import { loadAllQuestions } from "../lib/load-questions";

const ROOT = join(process.cwd(), "content/questions");
const INDEX_PATH = join(process.cwd(), "content/INDEX.md");
const HEADER =
  "<!-- AUTO-GENERATED — do not edit. Run `pnpm questions:index`. -->";

function firstLine(s: string, limit = 80): string {
  const collapsed = s.replace(/\s+/g, " ").trim();
  return collapsed.length > limit
    ? `${collapsed.slice(0, limit - 1)}…`
    : collapsed;
}

function buildIndex(): string {
  const all = loadAllQuestions(ROOT);
  const byCategory = new Map<string, typeof all>();
  for (const q of all) {
    const list = byCategory.get(q.category) ?? [];
    list.push(q);
    byCategory.set(q.category, list);
  }

  const sections: string[] = [HEADER, "", "# Question Index (auto)", ""];

  for (const cat of CATEGORIES) {
    const list = (byCategory.get(cat.id) ?? [])
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
    sections.push(`## ${cat.id} (${list.length})`);
    if (list.length === 0) {
      sections.push("");
      sections.push("_no questions yet_");
      sections.push("");
      continue;
    }
    sections.push("");
    for (const q of list) {
      const tags = q.tags.length > 0 ? ` — tags: ${q.tags.join(", ")}` : "";
      sections.push(`- \`${q.id}\` [${q.difficulty}]${tags}`);
      sections.push(`  > ${firstLine(q.question)}`);
    }
    sections.push("");
  }

  return `${sections.join("\n").replace(/\n+$/, "")}\n`;
}

function main() {
  const expected = buildIndex();
  const checkMode = process.argv.includes("--check");

  if (checkMode) {
    let actual = "";
    try {
      actual = readFileSync(INDEX_PATH, "utf8");
    } catch {
      console.error(
        "✗ content/INDEX.md is missing. Run `pnpm questions:index` and commit.",
      );
      process.exit(1);
    }
    if (actual !== expected) {
      console.error(
        "✗ content/INDEX.md is stale. Run `pnpm questions:index` and commit the result.",
      );
      process.exit(1);
    }
    console.log("✓ content/INDEX.md is up to date");
    return;
  }

  writeFileSync(INDEX_PATH, expected);
  console.log(`✓ wrote ${INDEX_PATH}`);
}

main();
