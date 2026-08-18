/**
 * 일회성 데이터 이전: Supabase(Postgres) shares 전량 → D1 INSERT SQL 덤프.
 *
 * 사용법:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SECRET_KEY=sb_secret_... \
 *   pnpm exec tsx scripts/export-shares-to-d1.ts > .cache/shares-dump.sql
 *
 *   pnpm exec wrangler d1 execute fe-quiz-shares --remote --file=.cache/shares-dump.sql
 *
 * 변환 규칙 (migrations/0001_create_shares.sql 참고):
 *   - question_ids text[]      → JSON 배열 문자열
 *   - category_scores jsonb    → JSON 객체 문자열
 *   - created_at timestamptz   → ISO8601 UTC "Z" 표기로 정규화
 *     (Postgres "+00:00" 표기와 SQLite 기본값의 문자열 정렬이 어긋나지 않게)
 *
 * 이미 존재하는 id는 INSERT OR IGNORE로 건너뛴다 — 컷오버 직전 재실행이
 * 안전하도록(신규 D1 row가 우선).
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY env vars.");
  process.exit(1);
}

interface ShareRow {
  id: string;
  question_ids: string[];
  score: number;
  feedback: string;
  result_type: string;
  category_scores: Record<string, { correct: number; total: number }>;
  created_at: string;
}

const PAGE_SIZE = 500;

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

async function fetchPage(offset: number): Promise<ShareRow[]> {
  const url = `${SUPABASE_URL}/rest/v1/shares?select=*&order=created_at.asc&offset=${offset}&limit=${PAGE_SIZE}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SECRET_KEY as string,
      authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as ShareRow[];
}

async function main() {
  const all: ShareRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await fetchPage(offset);
    all.push(...page);
    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  console.error(`# exporting ${all.length} rows`);

  const lines = all.map((row) => {
    const createdAt = new Date(row.created_at).toISOString();
    const cols = [
      sqlString(row.id),
      sqlString(JSON.stringify(row.question_ids)),
      String(row.score),
      sqlString(row.feedback),
      sqlString(row.result_type),
      sqlString(JSON.stringify(row.category_scores)),
      sqlString(createdAt),
    ].join(", ");
    return `INSERT OR IGNORE INTO shares (id, question_ids, score, feedback, result_type, category_scores, created_at) VALUES (${cols});`;
  });

  process.stdout.write(`${lines.join("\n")}\n`);
  console.error(
    `# done — pipe this into: wrangler d1 execute fe-quiz-shares --remote --file=<dump>`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
