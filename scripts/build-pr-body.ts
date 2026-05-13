/**
 * Render the PR body for the daily quiz-generate run.
 *
 * Pulls together:
 *   - the batch (which categories/difficulties/ids were targeted, from
 *     `.cache/batch.json`)
 *   - reviewer verdicts (`.cache/review/*.json`)
 *
 * The "which YAMLs actually survived to disk" view is computed indirectly:
 * a category with a reject verdict shows up as `reject` in the table, and
 * the workflow `rm`s that path before the PR is opened. We don't re-walk
 * the working tree here — that's the workflow's `git diff` gate's job.
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

const VERDICTS = ["approve", "reject"] as const;
type VerdictTag = (typeof VERDICTS)[number] | "missing" | "malformed";

type Verdict = {
  verdict: VerdictTag;
  reason?: string;
  citations?: string[];
  target?: string;
};

function isVerdictTag(v: unknown): v is (typeof VERDICTS)[number] {
  return typeof v === "string" && (VERDICTS as readonly string[]).includes(v);
}

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
      const raw = JSON.parse(readFileSync(join(REVIEW_DIR, name), "utf8")) as {
        verdict?: unknown;
        reason?: unknown;
        citations?: unknown;
        target?: unknown;
      };
      const target =
        typeof raw.target === "string"
          ? raw.target
          : name.replace(/\.json$/, "");
      const v: Verdict = {
        verdict: isVerdictTag(raw.verdict) ? raw.verdict : "malformed",
        reason: typeof raw.reason === "string" ? raw.reason : undefined,
        citations: Array.isArray(raw.citations)
          ? raw.citations.filter((u): u is string => typeof u === "string")
          : undefined,
        target,
      };
      map.set(target, v);
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
    // reviewer가 적은 target 경로에 카테고리 디렉터리 segment가 포함되면 매칭.
    // 이 매칭 실패 시 verdict는 "missing"(생성/검수 양 단계 중 한 곳에서 누락).
    const match = [...verdicts.entries()].find(([target]) =>
      target.includes(`/${item.category}/`),
    );
    const verdict: VerdictTag = match ? match[1].verdict : "missing";
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
