import { env } from "cloudflare:workers";
import { nanoid } from "nanoid";
import type { GradedRound } from "./grading";
import { logger } from "./logger.server";
import { normalizeNickname } from "./nickname";
import { type ShareRow, ShareRowSchema } from "./share.schema";
import {
  computeStanding,
  type RawEntry,
  rankEntries,
  type Standing,
  type StandingAggregate,
  type StandingEntry,
} from "./standing";

const SLUG_LENGTH = 8;
const MAX_SLUG_RETRIES = 3;

interface CreateShareInput {
  graded: GradedRound;
  result_type: string;
  feedback: string;
  /** 점수판 표시용. 없거나 정리 후 비면 NULL로 저장한다. */
  nickname?: string;
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
  nickname,
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
  // 클라이언트가 보낸 값 — 제어문자·공백·길이를 여기서 정리한다.
  const cleanNickname = normalizeNickname(nickname);

  let lastError: string | null = null;
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = nanoid(SLUG_LENGTH);
    try {
      await env.DB.prepare(
        "INSERT INTO shares (id, question_ids, score, feedback, result_type, category_scores, nickname) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
      )
        .bind(
          slug,
          questionIdsJson,
          score,
          feedback,
          result_type,
          categoryScoresJson,
          cleanNickname,
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
/** 점수판에 한 번에 보여줄 최대 인원. 내가 이 밖이면 내 줄만 따로 붙인다. */
const BOARD_LIMIT = 10;

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

/**
 * 이 라운드를 푼 사람들 사이에서 `share`의 위치.
 *
 * 라운드는 `question_ids` 문자열이 같은 row들로 묶는다 — 공유 링크 재도전은
 * 같은 문제를 같은 순서로 풀고, 저장 경로가 `JSON.stringify(순서대로의 id
 * 배열)` 하나뿐이라 문자열이 바이트 단위로 같다(마이그레이션 0002 주석 참고).
 * 그래서 별도 round_id 컬럼도, 클라이언트가 보내는 `from`도 필요 없다.
 *
 * 순위 계산은 `lib/standing.ts`(순수 함수, 테스트 있음)가 맡고 여기서는
 * 집계만 뽑는다. D1 장애 시 null을 돌려 점수판만 빠지고 결과 페이지 자체는
 * 뜨게 한다 — 공유 링크를 받은 사람에게 500을 보여줄 이유가 없다.
 */
export async function getRoundStanding(
  share: ShareRow,
): Promise<Standing | null> {
  const questionIdsJson = JSON.stringify(share.question_ids);
  try {
    const row = await env.DB.prepare(
      `SELECT
         COUNT(*) AS players,
         COALESCE(SUM(CASE WHEN score > ?2 THEN 1 ELSE 0 END), 0) AS better,
         COALESCE(AVG(score), 0) AS average,
         COALESCE(MAX(score), 0) AS best
       FROM shares
       WHERE question_ids = ?1`,
    )
      .bind(questionIdsJson, share.score)
      .first<Record<string, number>>();
    if (!row) {
      return null;
    }
    const agg: StandingAggregate = {
      players: Number(row.players) || 0,
      better: Number(row.better) || 0,
      // AVG는 소수를 돌려준다 — 화면에 63.33333이 새지 않게 여기서 접는다.
      average: Math.round(Number(row.average) || 0),
      best: Math.round(Number(row.best) || 0),
    };

    // 목록은 상위 N명만. 참가자가 많아져도 페이지가 무한정 길어지지 않고,
    // 동점 정렬은 먼저 푼 순(created_at)으로 안정화한다 — 순위 자체는
    // 점수만 보므로(rankEntries) 이 정렬은 표시 순서에만 영향을 준다.
    const list = await env.DB.prepare(
      `SELECT id, nickname, score
         FROM shares
        WHERE question_ids = ?1
        ORDER BY score DESC, created_at ASC
        LIMIT ${BOARD_LIMIT}`,
    )
      .bind(questionIdsJson)
      .all<RawEntry>();

    const ranked = rankEntries(list.results ?? [], share.id);
    // 내가 상위 N 밖이면 내 줄을 꼬리에 붙인다. 순위는 집계에서 이미 나왔다.
    const entries: StandingEntry[] = ranked.some((e) => e.is_me)
      ? ranked
      : [
          ...ranked,
          {
            id: share.id,
            nickname: share.nickname,
            score: share.score,
            rank: agg.better + 1,
            is_me: true,
          },
        ];

    return computeStanding(agg, entries);
  } catch (err) {
    logger.error(
      { err, id: share.id },
      "[share-store] getRoundStanding failed — 점수판 없이 렌더",
    );
    return null;
  }
}
