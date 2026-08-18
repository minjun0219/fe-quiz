# Supabase 마이그레이션 — 에이전트 가이드

> ⚠️ **DEPRECATED (2026-08)**: DB는 Cloudflare D1으로 이전됐어요
> ([ADR 0006](../docs/adr/0006-react-router-workers-d1.md), `migrations/`).
> 이 디렉터리는 데이터 이전 검증이 끝나고 Supabase 프로젝트를 해지할 때까지만
> 참고용으로 남아 있어요. 여기에 새 마이그레이션을 추가하지 마세요.

이 폴더는 **두 개의 분리된 Supabase 프로젝트**(prod / non-prod)에 적용돼요.
`migrations/` 아래에 뭐든 추가·삭제·수정하기 전에 이 문서부터 읽어 주세요.

## 마이그레이션 적용 흐름

`.github/workflows/migrate.yml`이 `supabase db push`를 자동으로 호출해요.
Supabase의 GitHub 네이티브 연동은 **사용 안 함**. 트리거 이벤트에 따라
어느 프로젝트에 push할지가 결정됩니다:

| 이벤트(event) | 대상 프로젝트 |
| --- | --- |
| `pull_request` (PR 열림/푸시) | **dev** (`SUPABASE_DEV_*`) |
| `push` to `main` (PR 머지 직후) | **prod** (`SUPABASE_*`) |
| `workflow_dispatch` (수동 실행) | **dev** 전용 (수동 prod는 의도적으로 금지) |

순서가 중요해요: **dev 적용 → preview 검증 → main 머지 → prod 적용**.
prod-first 경로는 두지 않아서, preview가 옛 스키마(old schema)를 읽으면서 PR을
잘못 검증하는 일이 없어요. 반대로 dev를 건너뛰고 main에 머지해도 prod 적용
자체는 안전 — 다만 다음 PR의 preview는 이번 SQL이 dev에 들어가기 전까지
깨진 상태가 됩니다.

`db push`는 idempotent예요 — 이미 적용된 마이그레이션은 자동으로 건너뜁니다.

## PR 체크리스트 (마이그레이션 포함 PR 한정)

- [ ] PR 푸시 후 `Apply Supabase migrations` 워크플로의 `apply` 잡이 **dev**에서 성공
- [ ] Vercel preview 배포에서 영향받는 플로우 검증
- [ ] 머지 후 같은 워크플로가 **prod**에서도 성공
- [ ] 운영 도메인 smoke check (공유 1회 생성)

## 필요한 GitHub Secrets

| Secret | 용도 |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI 인증 (계정 토큰) |
| `SUPABASE_PROJECT_REF` | prod 프로젝트 ref |
| `SUPABASE_DB_PASSWORD` | prod DB 비밀번호 |
| `SUPABASE_DEV_PROJECT_REF` | non-prod 프로젝트 ref |
| `SUPABASE_DEV_DB_PASSWORD` | non-prod DB 비밀번호 |

## 네이밍 컨벤션

파일명은 타임스탬프 prefix로 lexicographically 정렬되도록:
`YYYYMMDDHHMMSS_short_snake_case.sql`. Supabase CLI가 이 순서로 적용하기
때문에 잘못 명명된 파일은 체인을 깨요. 새 마이그레이션은 항상 뒤에 추가 —
이미 적용된 파일을 in-place로 수정하지 말고, 항상 forward migration으로 작성.

## ⚠️ 런타임 키와 결합된 마이그레이션

`20260509000002_lock_down_shares_rls.sql`은 anon·authenticated role grants를
회수해서 **secret/service-role 키 경로만** 동작하도록 만들어요. 환경별로
이 SQL을 적용하기 전에 해당 secret key가 먼저 배포돼 있어야 합니다:

- prod → `SUPABASE_SECRET_KEY`
- non-prod → `SUPABASE_DEV_SECRET_KEY`

secret key 없이 SQL만 먼저 적용하면 publishable-key 기반 호출 경로가 모두
`permission denied`로 403을 받아요. 런타임 클라이언트(`lib/supabase.ts`)가
유일한 합법 진입점이라는 점을 잊지 마세요.
