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

// 좁은 화면에서 자동 줄바꿈은 동작하지만, 80자가 넘는 한 줄은
// wrap 위치가 어색해 가독성이 떨어진다. 권장은 60~70자.
const MAX_CODE_LINE_LEN = 80;

try {
  const all = loadAllQuestions(ROOT);
  console.log(`✓ ${all.length} question${all.length === 1 ? "" : "s"} validated`);

  const warnings: string[] = [];
  for (const q of all) {
    if (!q.code) continue;
    const lines = q.code.split("\n");
    lines.forEach((line, i) => {
      if (line.length > MAX_CODE_LINE_LEN) {
        warnings.push(`  ${q.id} L${i + 1} (${line.length} chars): ${line}`);
      }
    });
  }

  if (warnings.length > 0) {
    console.warn(
      `\n⚠ ${warnings.length} code line${warnings.length === 1 ? "" : "s"} exceed ${MAX_CODE_LINE_LEN} chars — 좁은 화면에서 줄바꿈이 어색할 수 있어. 가능하면 60~70자에서 끊자.`,
    );
    for (const w of warnings) console.warn(w);
  }
} catch (err) {
  console.error("✗ Question validation failed:\n");
  console.error((err as Error).message);
  process.exit(1);
}
