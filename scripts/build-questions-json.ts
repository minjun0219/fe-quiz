/**
 * Build `lib/questions.generated.json` — 전체 문제 풀의 빌드 타임 번들.
 *
 * Workers 런타임에는 파일시스템이 없어 `content/questions/**` YAML을 요청
 * 시점에 읽을 수 없다. 이 스크립트가 zod 검증(`loadAllQuestions`)을 통과한
 * 전체 풀을 JSON으로 직렬화해 두면, `lib/questions.server.ts`가 정적 import로
 * 번들에 포함시킨다. 검증은 여기(생성 시점)와 `pnpm questions:check`에서
 * 끝나므로 런타임 재검증은 하지 않는다.
 *
 * Modes (build-questions-index.ts와 동일한 패턴):
 *   - default (`pnpm questions:bundle`): writes the file.
 *   - `--check` (`pnpm questions:bundle:check`): builds in memory, diffs
 *     against disk, exits 1 if stale. Wired into `prebuild`/`check`.
 *
 * 정답·해설 포함 주의: 이 파일은 서버 번들 전용이다. 클라이언트로는
 * `publicView()`를 거친 데이터만 나간다 (ADR 0005). 클라이언트 코드에서
 * 절대 직접 import 금지.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadAllQuestions } from "../lib/load-questions";

const ROOT = join(process.cwd(), "content/questions");
const OUT_PATH = join(process.cwd(), "lib/questions.generated.json");

function buildJson(): string {
  const all = loadAllQuestions(ROOT);
  // indent 1: 문제 추가/수정 PR에서 diff가 국소화되도록 줄 단위 직렬화.
  return `${JSON.stringify(all, null, 1)}\n`;
}

function main() {
  const expected = buildJson();
  const checkMode = process.argv.includes("--check");

  if (checkMode) {
    let actual = "";
    try {
      actual = readFileSync(OUT_PATH, "utf8");
    } catch {
      console.error(
        "✗ lib/questions.generated.json is missing. Run `pnpm questions:bundle` and commit.",
      );
      process.exit(1);
    }
    if (actual !== expected) {
      console.error(
        "✗ lib/questions.generated.json is stale. Run `pnpm questions:bundle` and commit the result.",
      );
      process.exit(1);
    }
    console.log("✓ lib/questions.generated.json is up to date");
    return;
  }

  writeFileSync(OUT_PATH, expected);
  console.log(`✓ wrote ${OUT_PATH}`);
}

main();
