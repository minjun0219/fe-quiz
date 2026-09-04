-- 점수판에 표시할 닉네임.
--
-- nullable인 이유는 두 가지다. 이 컬럼 이전에 만들어진 row가 있고(NULL →
-- 화면에서 "익명"), 앞으로도 닉네임 없이 공유하는 경로가 열려 있다.
--
-- 인증이 없으므로 이 값은 신원 증명이 아니다 — 클라이언트가 보내는 임의
-- 문자열이고 사칭을 막지 않는다(친구끼리 돌려보는 규모라 방어 대상이 아니다).
-- 서버는 형식만 정리한다: 제어문자 제거, 연속 공백 접기, 16자 상한
-- (`lib/nickname.ts`의 normalizeNickname).
ALTER TABLE shares ADD COLUMN nickname TEXT;
