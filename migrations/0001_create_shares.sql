-- shares: 결과 공유 1테이블 (구 Supabase Postgres에서 D1/SQLite로 이식).
--
-- Postgres 대비 타입 매핑:
--   question_ids    text[]      → TEXT (JSON 배열 문자열; 순서 보존이 공유
--                                 replay 계약의 핵심이라 JSON 배열이 적합)
--   category_scores jsonb       → TEXT (JSON 객체 문자열)
--   created_at      timestamptz → TEXT (ISO8601 UTC; lexicographic 정렬이
--                                 시간 정렬과 일치)
--
-- 구 마이그레이션의 RLS/GRANT는 이식하지 않는다 — D1은 Worker binding이
-- 유일한 접근 경로라 공개 REST 표면 자체가 없다 (ADR 0006).

CREATE TABLE IF NOT EXISTS shares (
  id              TEXT PRIMARY KEY,
  question_ids    TEXT NOT NULL CHECK (json_valid(question_ids)),
  score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  feedback        TEXT NOT NULL,
  result_type     TEXT NOT NULL,
  category_scores TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(category_scores)),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_shares_created_at ON shares (created_at DESC);
