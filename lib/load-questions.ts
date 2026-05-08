import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { type Question, QuestionSchema } from "./question.schema";

/**
 * Walk a `content/questions/` root directory, parse + validate every YAML.
 * Pure function — no caching, no `server-only`, no Next.js coupling — so the
 * build-time check script can call this in plain Node too.
 *
 * Throws on the first failure with `category/file` context.
 *
 * Validations:
 *   - zod schema (per file)
 *   - directory category matches `question.category`
 *   - all `id`s are unique across the tree
 */
export function loadAllQuestions(rootDir: string): Question[] {
  const out: Question[] = [];
  const seenIds = new Map<string, string>();

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
      const raw = readFileSync(join(dir, entry.name), "utf8");
      const data = parseYaml(raw);

      const result = QuestionSchema.safeParse(data);
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("\n");
        throw new Error(`Invalid question at ${relPath}:\n${issues}`);
      }

      if (result.data.category !== category) {
        throw new Error(
          `Category mismatch at ${relPath}: id "${result.data.id}" declares category "${result.data.category}" but file lives under "${category}/"`,
        );
      }

      const prev = seenIds.get(result.data.id);
      if (prev) {
        throw new Error(
          `Duplicate question id "${result.data.id}" at ${relPath} (also defined at ${prev})`,
        );
      }
      seenIds.set(result.data.id, relPath);
      out.push(result.data);
    }
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}
