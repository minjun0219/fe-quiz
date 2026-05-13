/**
 * Render the PR body for the daily quiz-generate run.
 *
 * Pulls together:
 *   - the batch (which categories/difficulties/ids were targeted)
 *   - reviewer verdicts (`.cache/review/*.json`)
 *   - the set of YAML paths that actually survived to the working tree
 *
 * Stdout is the PR body. The workflow redirects it to `.cache/pr-body.md`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = join(process.cwd(), ".cache");
const BATCH_PATH = join(CACHE_DIR, "batch.json");
const REVIEW_DIR = join(CACHE_DIR, "review");

type BatchEntry = {
  category: string;
  difficulty: string;
  next_id: string;
};

type Verdict = {
  verdict: "approve" | "reject";
  reason?: string;
  citations?: string[];
  target?: string;
};

function readBatch(): BatchEntry[] {
  if (!existsSync(BATCH_PATH)) {
    return [];
  }
  return JSON.parse(readFileSync(BATCH_PATH, "utf8"));
}

function readVerdicts(): Map<string, Verdict> {
  const map = new Map<string, Verdict>();
  if (!existsSync(REVIEW_DIR)) {
    return map;
  }
  for (const name of readdirSync(REVIEW_DIR)) {
    if (!name.endsWith(".json")) {
      continue;
    }
    try {
      const v = JSON.parse(
        readFileSync(join(REVIEW_DIR, name), "utf8"),
      ) as Verdict;
      const key = (v.target ?? name.replace(/\.json$/, "")).toString();
      map.set(key, v);
    } catch {
      // ignore malformed verdict files; the workflow log already surfaced them.
    }
  }
  return map;
}

function main() {
  const batch = readBatch();
  const verdicts = readVerdicts();

  const lines: string[] = [];
  lines.push("## 자동 출제 결과");
  lines.push("");
  lines.push(
    "`/generate-quiz` 워크플로가 카테고리별 sub-agent로 신규 문제를 작성하고 `/review-quiz` 가 출처를 교차 검증한 결과예요.",
  );
  lines.push("");
  lines.push("| 카테고리 | 난이도 | id | 검수 결과 |");
  lines.push("| --- | --- | --- | --- |");
  for (const item of batch) {
    const v = [...verdicts.entries()].find(
      ([target]) =>
        target.includes(`/${item.category}/`) ||
        target.startsWith(item.category),
    );
    const verdict = v ? v[1].verdict : "missing";
    lines.push(
      `| \`${item.category}\` | ${item.difficulty} | \`${item.next_id}\` | ${verdict} |`,
    );
  }
  lines.push("");

  const rejects = [...verdicts.values()].filter((v) => v.verdict === "reject");
  if (rejects.length > 0) {
    lines.push("### Reject 사유");
    for (const v of rejects) {
      lines.push(`- \`${v.target ?? "?"}\`: ${v.reason ?? "(사유 미기재)"}`);
    }
    lines.push("");
  }

  const cites = [
    ...new Set(
      [...verdicts.values()]
        .flatMap((v) => v.citations ?? [])
        .filter((u) => u.startsWith("https://")),
    ),
  ];
  if (cites.length > 0) {
    lines.push("### 검수 출처");
    for (const url of cites) {
      lines.push(`- ${url}`);
    }
    lines.push("");
  }

  lines.push(
    "⚠️ **반드시 사람이 정답·해설·출처를 직접 검토한 뒤 머지하세요.** LLM이 잘못된 사양을 주장할 수 있습니다.",
  );

  process.stdout.write(`${lines.join("\n")}\n`);
}

main();
