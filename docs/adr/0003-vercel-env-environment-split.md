# 0003. 환경 분기는 `VERCEL_ENV` 기준 (`NODE_ENV` 금지)

- 상태: Accepted
- 결정일: 2026-05-09
- 관련: `lib/supabase.ts`, [docs/DECISIONS.md](../DECISIONS.md), [AGENTS.md](../../AGENTS.md)

## 맥락

운영 Supabase와 비운영(preview/local/CI) Supabase를 두 프로젝트로 분리하기로
했고(prod 데이터 보호 + 자유로운 스키마 실험), 서버 코드는 어느 환경에서 도는지
판별해 알맞은 URL/키 쌍을 골라야 해요.

직관적으로는 `process.env.NODE_ENV === "production"`이지만, 함정이 있어요:
**`next start`는 로컬에서도 `NODE_ENV=production`을 세팅**해요. 즉 로컬에서
production 빌드를 띄워 동작을 확인하는 평범한 워크플로(`pnpm build && pnpm
start`)가 곧 운영 Supabase로 직결되는 사고 경로가 돼요. preview 배포에서도
`NODE_ENV=production`은 동일하게 박혀요.

## 결정

환경 분기는 **`process.env.VERCEL_ENV === "production"`** 기준만 사용.

- `lib/supabase.ts`:
  - production → `SUPABASE_URL` / `SUPABASE_SECRET_KEY` (운영 전용 프로젝트)
  - 그 외 (Vercel preview, 로컬, CI) → `SUPABASE_DEV_URL` /
    `SUPABASE_DEV_SECRET_KEY` (공유 개발 프로젝트)
- `VERCEL_ENV`는 Vercel 런타임에서만 박히는 값이라, 로컬·CI에서는 자연스럽게
  비운영 경로로 떨어져요.
- `NODE_ENV` 기반 분기는 **금지**. 같은 패턴을 추가하는 모듈이 새로 생기면
  이 ADR을 참조하라고 해주세요.

## 결과

- `pnpm build && pnpm start`로 로컬 prod 빌드를 돌려도 dev Supabase만 침.
- preview 배포는 항상 dev Supabase로 떨어짐 — preview에서 prod 데이터를 오염
  시킬 수 없음.
- **포기한 것**: 표준 Node 환경 분기 패턴(`NODE_ENV`)을 못 씀. Vercel이 아닌
  플랫폼으로 이주하게 되면 `VERCEL_ENV`를 폴리필하거나 분기 키를 갈아끼우는
  작업이 필요해요. 현재 호스팅 가정은 Vercel이므로 합리적 트레이드오프.
- **함정**: 새 third-party 통합(분석, 로깅, AI 등)을 붙일 때 "prod에서만 활성"
  분기를 짤 때도 `VERCEL_ENV`를 써야 해요. `NODE_ENV`를 쓰면 로컬 prod 빌드에서
  실제 production 백엔드를 두드리게 됨.
