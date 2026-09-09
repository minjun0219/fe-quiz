/**
 * Build-time guard: validate every YAML under `content/questions/` against
 * the zod schema, the loader's invariants (unique ids, directory ↔ category
 * match), the prose/code wrapping convention, and the `hint:` no-leak rule
 * (see `content/AGENTS.md`).
 * Wired into the `prebuild` script so CI/Vercel fail before Next.js starts
 * compiling on a broken seed.
 *
 * Run via `pnpm questions:check` (uses tsx).
 */
import { join } from "node:path";
import { loadAllQuestions } from "../lib/load-questions";
import type { Question } from "../lib/question.schema";
import { formatHintLeakHits, lintHintLeak } from "./lint-hint-leak";
import { formatHits, lintQuestionProse } from "./lint-question-prose";

const ROOT = join(process.cwd(), "content/questions");

let all: Question[];
try {
  all = loadAllQuestions(ROOT);
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

const leaks = lintHintLeak(all);
if (leaks.length > 0) {
  console.error(
    `✗ ${leaks.length} hint${leaks.length === 1 ? " gives" : "s give"} away the answer (see content/AGENTS.md):\n`,
  );
  console.error(formatHintLeakHits(leaks));
  process.exit(1);
}
console.log("✓ hints do not leak answers");
