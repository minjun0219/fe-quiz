-- shares: 라운드 결과를 익명으로 저장. 공유 링크의 source of truth.
-- id는 nanoid (6-8자리). question_ids는 라운드에 출제된 문제 ID 순서.
-- 동일 라운드를 친구가 풀 때 같은 순서로 재생하기 위해 question_ids를 array로 저장.

create table if not exists public.shares (
  id              text primary key,
  question_ids    text[]      not null,
  score           int         not null check (score between 0 and 100),
  feedback        text        not null,
  result_type     text        not null,
  category_scores jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_shares_created_at
  on public.shares (created_at desc);

-- RLS: 익명 사용자가 INSERT/SELECT 모두 가능.
-- 모든 쓰기는 서버 route handler를 거쳐 검증된 데이터만 들어옴.
-- (UPDATE/DELETE는 정책 미생성 → 차단)
alter table public.shares enable row level security;

create policy "anon can insert shares"
  on public.shares
  for insert
  to anon
  with check (true);

create policy "anon can select shares"
  on public.shares
  for select
  to anon
  using (true);
