-- shares: anon에게 INSERT/SELECT GRANT.
--
-- 왜 별도 마이그레이션인가:
-- Supabase 프로젝트의 "Automatically expose new tables" 옵션이 OFF(권장 설정)면
-- 새 테이블이 생겨도 `anon` role에게 자동 GRANT가 안 붙는다. 결과적으로 RLS
-- 정책은 통과해도 그 이전 단계에서 "permission denied for table shares" 발생.
-- (실제로 production에서 이 증상이 뜸)
--
-- 0001 마이그레이션이 생성한 RLS 정책은 행 단위 가시성을 통제하지만, 그 전에
-- role이 테이블 자체에 권한이 있어야 한다. INSERT/SELECT만 부여하고 UPDATE/DELETE는
-- 정책 미생성 + GRANT 미부여 두 겹으로 차단 유지.
--
-- 의도적으로 `authenticated`는 부여하지 않는다. v1엔 auth 자체가 없고, 0001의
-- RLS 정책도 `to anon` 한정이라 `authenticated`에 GRANT만 붙여도 정책 미일치로
-- 차단됨 — 죽은 권한이 됨. 나중에 auth 도입 시 정책 + GRANT 한 묶음으로 추가.

grant select, insert on public.shares to anon;

