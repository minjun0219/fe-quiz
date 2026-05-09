-- shares: anon 우회 경로 차단 (Codex P1 후속 조치).
--
-- 0001은 RLS 정책을 `to anon using(true) / with check(true)`로 만들었고
-- 0002(첫 번째)는 `grant select, insert ... to anon`을 부여했다. 이 조합은
-- publishable 키만 있으면 누구나 supabase REST API 직호출로:
--   - 가짜 share row INSERT (서버 검증 우회)
--   - shares 전체 SELECT (스크레이핑)
-- 이 가능했음 → Codex P1.
--
-- 서버 클라이언트를 service_role 키로 전환하면서 anon 경로를 닫는다.
-- service_role은 RLS를 우회하고 모든 테이블 권한을 자동 보유하므로 별도
-- 정책/grant가 필요 없다. RLS는 enabled 그대로 두면 anon 키로 들어올 때
-- 정책 0개 → deny by default.
--
-- 적용 후, 서버 코드(lib/supabase.ts)가 SUPABASE_SERVICE_ROLE_KEY로 동작
-- 가능한 상태여야 함. 환경변수가 안 바뀐 상태에서 이 SQL만 실행하면
-- 이전 publishable-key-기반 코드가 `permission denied`로 깨진다.

drop policy if exists "anon can insert shares" on public.shares;
drop policy if exists "anon can select shares" on public.shares;

revoke select, insert on public.shares from anon;
