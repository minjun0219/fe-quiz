# 0002. Supabase `shares`는 서버 전용 secret 키로만 접근

- 상태: Superseded by [0006](./0006-react-router-workers-d1.md) — D1 binding 전환으로 공개 REST 표면 자체가 사라져 이 잠금 모델이 불필요해짐
- 결정일: 2026-05-09
- 관련: `supabase/migrations/20260509000002_lock_down_shares_rls.sql`, `lib/supabase.ts`, `app/api/share/`, [docs/DECISIONS.md](../DECISIONS.md)

## 맥락

초기 마이그레이션(`20260508000001_create_shares.sql` +
`20260509000001_grant_anon_on_shares.sql`)은 `shares`에 anon 역할로
`select/insert` 정책과 GRANT를 부여했어요. publishable 키만 있으면 누구나
Supabase REST API 직호출로:

- 가짜 share row INSERT — 서버 채점/검증을 우회
- shares 전체 SELECT — 스크레이핑

이 가능했고, 이건 Codex P1로 식별됐어요.

서버 사이드 채점(`POST /api/share`가 서버에서 다시 채점해 저장)이 보안의 1차
계층이지만, anon이 직접 테이블에 닿을 수 있다면 그 계층은 우회 가능한 옵션에
불과해요. RLS 정책으로 `with check(false)`를 거는 것만으로는 부족 — `grant`가
남아 있으면 정책 변경 시점 사이에 노출이 생기고, "Automatically expose new
tables" 같은 콘솔 옵션이 다시 켜지면 안전망이 깨져요.

## 결정

`shares` 테이블은 **서버 환경의 secret/service-role 키로만** 접근해요.

- `20260509000002_lock_down_shares_rls.sql`에서 anon 정책 두 개를 `drop`,
  `revoke all on public.shares from anon, authenticated`로 권한을 회수.
- `service_role`에 `select, insert`만 명시적으로 GRANT — RLS는 우회되지만
  테이블 권한은 별도라 "auto-expose off" 환경에서도 라우트 핸들러가 동작.
- 서버 클라이언트(`lib/supabase.ts`)는 `SUPABASE_SECRET_KEY`(legacy
  service_role JWT 또는 새 `sb_secret_...`)로 동작. 둘 다 RLS 우회.
- `lib/supabase.ts`는 `import "server-only"`로 클라이언트 컴포넌트 import를
  빌드 타임에 차단.
- `NEXT_PUBLIC_SUPABASE_*` 환경변수는 쓰지 않아요. 클라이언트는 Supabase에
  직접 닿지 않는 모델.

## 결과

- 가짜 share INSERT 경로가 차단됨. 라우트 핸들러가 유일한 합법 entry point.
- 스크레이핑 방지 — anon은 `shares`를 SELECT할 수 없음.
- **포기한 것**: 클라이언트에서 Supabase JS 클라이언트로 share를 직접 만들거나
  읽는 패턴은 불가능. 모든 read/write는 API 라우트를 거쳐야 함.
- **함정**: Supabase 콘솔에서 "Automatically expose new tables"가 다시 켜지거나
  누군가 수기로 `grant`를 추가해도 다음 마이그레이션 적용 시점에 자동으로 다시
  잠겨요(belt-and-suspenders로 마이그레이션이 매번 `revoke all`을 다시 적용). 새
  테이블을 추가할 때도 같은 패턴을 따라야 해요.
- **함정**: `SUPABASE_SECRET_KEY`는 절대로 `NEXT_PUBLIC_` 접두사로 노출 금지.
  `lib/supabase.ts`의 `server-only` 가드가 1차 방어이고, 환경변수 이름 컨벤션이
  2차 방어예요.
