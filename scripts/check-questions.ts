/**
 * Build-time guard: validate every YAML under `content/questions/` against
 * the zod schema and the loader's invariants (unique ids, directory ↔ category
 * match). Wired into the `prebuild` script so CI/Vercel fail before Next.js
 * starts compiling on a broken seed.
 *
 * Run via `pnpm questions:check` (uses tsx).
 */
import { join } from "node:path";
import { loadAllQuestions } from "../lib/load-questions";

const ROOT = join(process.cwd(), "content/questions");

try {
  const all = loadAllQuestions(ROOT);
  console.log(`✓ ${all.length} question${all.length === 1 ? "" : "s"} validated`);
} catch (err) {
  console.error("✗ Question validation failed:\n");
  console.error((err as Error).message);
  process.exit(1);
}
