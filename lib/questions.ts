import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { type Question, QuestionSchema } from "./question.schema";

const ROOT = join(process.cwd(), "content/questions");

let cache: Question[] | null = null;

/**
 * Load all question YAML files from `content/questions/<category>/*.yaml`.
 * Validates each via zod; throws with file path on first failure.
 *
 * Server-only — uses node:fs. Module-level cache means the file system is
 * walked once per process.
 */
export function getAllQuestions(): Question[] {
  if (cache) return cache;

  const out: Question[] = [];
  const categories = readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const category of categories) {
    const dir = join(ROOT, category);
    const files = readdirSync(dir).filter((f) => f.endsWith(".yaml"));
    for (const file of files) {
      const path = join(dir, file);
      const raw = readFileSync(path, "utf8");
      const data = parseYaml(raw);
      const result = QuestionSchema.safeParse(data);
      if (!result.success) {
        throw new Error(
          `Invalid question at ${category}/${file}: ${JSON.stringify(result.error.issues, null, 2)}`,
        );
      }
      out.push(result.data);
    }
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  cache = out;
  return cache;
}

export function getQuestionsByCategory(category: Question["category"]): Question[] {
  return getAllQuestions().filter((q) => q.category === category);
}

export function getQuestionById(id: string): Question | undefined {
  return getAllQuestions().find((q) => q.id === id);
}
