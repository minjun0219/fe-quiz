import { env } from "cloudflare:workers";
import { nanoid } from "nanoid";
import type { GradedRound } from "./grading";
import { logger } from "./logger.server";
import { type ShareRow, ShareRowSchema } from "./share.schema";

const SLUG_LENGTH = 8;
const MAX_SLUG_RETRIES = 3;

interface CreateShareInput {
  graded: GradedRound;
  result_type: string;
  feedback: string;
}

/**
 * shares 테이블은 D1 binding(`env.DB`)으로만 접근한다 — Worker 밖에서 닿을 수
 * 있는 공개 REST 표면이 없으므로 구 Supabase 시절의 RLS/GRANT 잠금이 필요
 * 없다 (ADR 0006). `question_ids`/`category_scores`는 SQLite에 배열/jsonb
 * 타입이 없어 JSON 문자열(TEXT)로 저장하고 읽을 때 parse한다.
 */

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Error && err.message.includes("UNIQUE constraint failed")
  );
}

/**
 * Insert a new shares row. Returns the slug. Score is stored as a percentage
 * (0..100) to match the DB CHECK constraint; total_correct is recoverable on
 * read via `round(score * question_ids.length / 100)`.
 *
 * On slug collision (UNIQUE violation) we regenerate and retry up to
 * MAX_SLUG_RETRIES times. With 8-char nanoid the collision rate is
 * negligible, but a hard failure on a busy day shouldn't block a share.
 */
export async function createShare({
  graded,
  result_type,
  feedback,
}: CreateShareInput): Promise<string> {
  // Clamp to the DB CHECK constraint range so any rounding edge case (or a
  // future caller passing a score > total) can't trip the constraint.
  const rawScore =
    graded.total === 0
      ? 0
      : Math.round((graded.total_correct / graded.total) * 100);
  const score = Math.min(100, Math.max(0, rawScore));

  const questionIdsJson = JSON.stringify(graded.per_question.map((q) => q.id));
  const categoryScoresJson = JSON.stringify(graded.category_scores);

  let lastError: string | null = null;
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = nanoid(SLUG_LENGTH);
    try {
      await env.DB.prepare(
        "INSERT INTO shares (id, question_ids, score, feedback, result_type, category_scores) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      )
        .bind(
          slug,
          questionIdsJson,
          score,
          feedback,
          result_type,
          categoryScoresJson,
        )
        .run();
      return slug;
    } catch (err) {
      if (!isUniqueViolation(err)) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to create share: ${message}`);
      }
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(
    `Failed to create share after ${MAX_SLUG_RETRIES} slug retries: ${lastError}`,
  );
}

/**
 * Fetch a shares row by slug. Returns null if not found OR if the row's
 * shape doesn't survive JSON parse + `ShareRowSchema` — 과거 데이터 이전이나
 * 수동 조작으로 형태가 어긋난 row가 NaN 폭/undefined 라벨로 새는 것보다
 * "없는 결과" 취급이 안전하다.
 */
// D1은 write 직후 read가 다른 콜로에서 잠깐 못 볼 수 있다(복제 지연 — 공유
// 생성 → "미리보기" 즉시 클릭 경로에서 실측). null일 때만 짧게 재시도해
// 간헐적 404를 흡수한다. 진짜 없는 slug는 404가 ~300ms 늦어질 뿐.
const NOT_FOUND_RETRIES = 2;
const NOT_FOUND_RETRY_DELAY_MS = 150;

export async function getShareById(id: string): Promise<ShareRow | null> {
  let raw: Record<string, unknown> | null = null;
  for (let attempt = 0; ; attempt++) {
    raw = await env.DB.prepare("SELECT * FROM shares WHERE id = ?1")
      .bind(id)
      .first<Record<string, unknown>>();
    if (raw || attempt >= NOT_FOUND_RETRIES) {
      break;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, NOT_FOUND_RETRY_DELAY_MS),
    );
  }
  if (!raw) {
    return null;
  }

  let revived: unknown;
  try {
    revived = {
      ...raw,
      question_ids: JSON.parse(String(raw.question_ids)),
      category_scores: JSON.parse(String(raw.category_scores)),
    };
  } catch {
    logger.error({ id }, "[share-store] row has malformed JSON columns");
    return null;
  }

  const parsed = ShareRowSchema.safeParse(revived);
  if (!parsed.success) {
    logger.error(
      { id, issues: parsed.error.issues },
      "[share-store] row failed schema validation",
    );
    return null;
  }
  return parsed.data;
}
