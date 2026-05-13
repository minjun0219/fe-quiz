/**
 * Read the JSON outputs produced by `quiz-author` sub-agents (one file per
 * category at `.cache/out/<category>.json`), validate them against the
 * canonical Zod schema, and serialize them as YAML into `content/questions/`.
 *
 * Why we serialize here instead of letting the sub-agent write YAML directly:
 *   - key order, quote style, and block-scalar choice are deterministic from
 *     this script, so the prose lint (which scans raw text for code-shape
 *     leaks) sees the same shape every time.
 *   - id/category are forcibly re-injected from `.cache/batch.json`, so an
 *     author hallucinating a different id cannot break the unique-id invariant.
 *
 * The script tolerates per-category failures (missing file, bad JSON, Zod
 * miss) — it reports them to stderr and skips, so a single bad output never
 * sinks the whole batch. The schema gate runs again from the workflow via
 * `pnpm questions:check`, so anything the loader-level invariants miss
 * (cross-file id collisions, category↔dir mismatch) still fails fast.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { getIdPrefix } from "../lib/categories";
import { QuestionSchema } from "../lib/question.schema";

const CACHE_DIR = join(process.cwd(), ".cache");
const OUT_DIR = join(CACHE_DIR, "out");
const BATCH_PATH = join(CACHE_DIR, "batch.json");
const CONTENT_ROOT = join(process.cwd(), "content/questions");

type BatchEntry = {
  category: string;
  difficulty: string;
  next_id: string;
};

const KEY_ORDER = [
  "id",
  "category",
  "difficulty",
  "type",
  "question",
  "code",
  "choices",
  "answer",
  "explanation",
  "references",
  "tags",
] as const;

function reorderKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of KEY_ORDER) {
    if (key in obj) {
      out[key] = obj[key];
    }
  }
  return out;
}

function normalizeSlug(raw: unknown, fallback: string): string {
  const candidate =
    typeof raw === "string"
      ? raw
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40)
      : "";
  return candidate.length > 0 ? candidate : fallback;
}

function readBatch(): BatchEntry[] {
  if (!existsSync(BATCH_PATH)) {
    console.error(
      `✗ ${BATCH_PATH} not found. Run \`pnpm questions:prepare-batch <cats>\` first.`,
    );
    process.exit(1);
  }
  return JSON.parse(readFileSync(BATCH_PATH, "utf8")) as BatchEntry[];
}

function main() {
  const batch = readBatch();
  if (!existsSync(OUT_DIR)) {
    console.error(
      `✗ ${OUT_DIR} not found. The author step must populate one file per category here.`,
    );
    process.exit(1);
  }

  const present = new Set(
    readdirSync(OUT_DIR).filter((n) => n.endsWith(".json")),
  );

  let written = 0;
  let skipped = 0;

  for (const entry of batch) {
    const filename = `${entry.category}.json`;
    if (!present.has(filename)) {
      console.error(`  · skip ${entry.category}: missing ${filename}`);
      skipped++;
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(OUT_DIR, filename), "utf8"));
    } catch (err) {
      console.error(
        `  · skip ${entry.category}: invalid JSON (${(err as Error).message})`,
      );
      skipped++;
      continue;
    }

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      console.error(`  · skip ${entry.category}: response is not an object`);
      skipped++;
      continue;
    }

    const obj = raw as Record<string, unknown>;
    const idNum = Number(entry.next_id.split("-").pop());
    const slug = normalizeSlug(obj.slug, `auto-${entry.next_id}`);

    // Strip any keys the author wrongly emitted (id, category, slug); we
    // re-inject the trusted values from the batch.
    delete obj.id;
    delete obj.category;
    delete obj.slug;

    const candidate = reorderKeys({
      id: entry.next_id,
      category: entry.category,
      difficulty: obj.difficulty ?? entry.difficulty,
      ...obj,
    });

    // Re-derive the difficulty too so the author can't override it.
    candidate.difficulty = entry.difficulty;

    const parsed = QuestionSchema.safeParse(candidate);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `      ${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n");
      console.error(`  · skip ${entry.category}: schema failed\n${issues}`);
      skipped++;
      continue;
    }

    // Re-order on the validated object too (the parsed shape lost the original
    // ordering through Zod's runtime transform).
    const final = reorderKeys(
      parsed.data as unknown as Record<string, unknown>,
    );

    const yaml = stringifyYaml(final, {
      lineWidth: 0,
      blockQuote: "literal",
      sortMapEntries: false,
    });

    const prefix = getIdPrefix(parsed.data.category);
    if (parsed.data.id !== `${prefix}-${String(idNum).padStart(3, "0")}`) {
      console.error(
        `  · skip ${entry.category}: id mismatch (${parsed.data.id} vs ${entry.next_id})`,
      );
      skipped++;
      continue;
    }

    // 파일명 정렬을 위한 패딩은 id 자릿수(3)와 맞춘다 — 100번째 문제부터
    // `99-…` 다음에 `100-…`가 자연 정렬되도록.
    const numLabel = String(idNum).padStart(3, "0");
    const outDir = join(CONTENT_ROOT, parsed.data.category);
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, `${numLabel}-${slug}.yaml`);
    writeFileSync(outFile, yaml);
    console.log(`  · wrote ${outFile}`);
    written++;
  }

  console.log(`✓ ${written} written, ${skipped} skipped`);
  if (written === 0) {
    process.exit(2);
  }
}

main();
