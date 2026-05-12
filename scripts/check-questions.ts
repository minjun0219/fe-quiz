/**
 * Build-time guard: validate every YAML under `content/questions/` against
 * the zod schema, the loader's invariants (unique ids, directory ↔ category
 * match), and the prose/code wrapping convention (see `content/AGENTS.md`).
 * Wired into the `prebuild` script so CI/Vercel fail before Next.js starts
 * compiling on a broken seed.
 *
 * Run via `pnpm questions:check` (uses tsx).
 */
import { join } from "node:path";
import { loadAllQuestions } from "../lib/load-questions";
import { formatHits, lintQuestionProse } from "./lint-question-prose";

const ROOT = join(process.cwd(), "content/questions");

try {
  const all = loadAllQuestions(ROOT);
  console.log(
    `✓ ${all.length} question${all.length === 1 ? "" : "s"} validated`,
  );
} catch (err) {
  console.error("✗ Question validation failed:\n");
  console.error((err as Error).message);
  process.exit(1);
}

const hits = lintQuestionProse(ROOT);
if (hits.length > 0) {
  console.error(
    `✗ ${hits.length} unwrapped code-shaped value${hits.length === 1 ? "" : "s"} (see content/AGENTS.md):\n`,
  );
  console.error(formatHits(hits));
  process.exit(1);
}
console.log("✓ prose/code wrapping convention OK");
