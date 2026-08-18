# 0006. 호스팅·프레임워크·DB를 Cloudflare 스택으로 이전 (React Router + Workers + D1)

- 상태: Accepted
- 결정일: 2026-08-18
- 대체: [0002](./0002-supabase-server-only-secret-key.md), [0003](./0003-vercel-env-environment-split.md)
- 관련: `wrangler.jsonc`, `workers/app.ts`, `app/routes.ts`, `migrations/0001_create_shares.sql`, `lib/share-store.server.ts`, [docs/DECISIONS.md](../DECISIONS.md)

## 맥락

v1은 Vercel(호스팅) + Next.js 16 App Router + Supabase(`shares` 1테이블) +
Upstash(rate limit) 구성이었어요. Cloudflare로의 전면 이전을 결정하면서 두
가지 경로를 검토했어요:

1. **Next.js 유지 + OpenNext 어댑터** — 코드 변경 최소지만 번들이 무거워
   Workers 무료 플랜(압축 3MiB) 한도가 빠듯하고, Vercel 전용 규약(`VERCEL_*`
   env, `next/og`, rewrites)을 어댑터 위에서 계속 끌고 가야 해요.
2. **프레임워크 교체 (React Router framework mode)** — 이 앱의 Next 의존이
   얕았어요: 페이지 3, API 라우트 3, RSC 거의 미사용, 코드 대부분이 순수 함수
   (grading/diagnosis/round-picker)와 클라이언트 React 컴포넌트. ISR·이미지
   최적화·서버 액션 등 Next 고유 기능은 미사용.

DB도 함께 검토: supabase-js는 Workers에서 동작하므로 유지 가능했지만,
테이블이 1개뿐이고 ADR 0002의 보안 모델(공개 REST 표면을 RLS+GRANT로 잠그기)
자체가 D1 binding 모델에서는 **불필요해져요** — binding은 Worker 코드만 접근
가능하고 공개 엔드포인트가 애초에 없어요.

## 결정

- **React Router v8 framework mode + `@cloudflare/vite-plugin`** (Cloudflare
  공식 템플릿 구조). 라우트는 `app/routes.ts` config 방식, API URL 계약
  (`/api/quiz/submit`, `/api/quiz/feedback`, `/api/share`)은 그대로 유지.
- **D1**로 `shares` 이전 (`migrations/0001_create_shares.sql`): `text[]`→JSON
  TEXT, `jsonb`→TEXT(+`json_valid` CHECK), `timestamptz`→ISO8601 UTC TEXT.
  기존 Supabase 데이터는 `scripts/export-shares-to-d1.ts`로 이전.
- **환경 분리는 wrangler env** — top-level(로컬 dev) / `env.preview` /
  `env.production`, 각각 전용 D1 + `APP_ENV`/`SITE_URL` vars. ⚠️ 환경 선택은
  **빌드 타임**(`CLOUDFLARE_ENV`) — vite 플러그인이 resolved config를 굽고
  `wrangler deploy`는 그걸 올려요. `wrangler deploy --env`는 무시됨.
- **질문 YAML은 빌드 타임 번들** — Workers엔 파일시스템이 없으므로
  `scripts/build-questions-json.ts`가 zod 검증 후
  `lib/questions.generated.json`을 생성(git 커밋 + `--check` 게이트), 런타임은
  정적 import.
- 부속 교체: `next/og`→`workers-og`(`/r/:slug/og.png` 명시 라우트),
  pino→console 기반 `lib/logger.server.ts`, `server-only`→`.server.ts` 컨벤션,
  `after()`→`cloudflare:workers`의 `waitUntil`, PostHog `/ingest` 프록시는
  `workers/app.ts` 진입점 분기, `@vercel/analytics` 제거(PostHog 단일화).

## 결과

- 켜진 보장: 공개 DB 표면 제거(RLS 고민 소멸 — ADR 0002 대체), env 분기 명시화
  (`VERCEL_ENV` 의존 소멸— ADR 0003 대체), 번들 gzip ~1.2MiB로 무료 플랜 여유,
  Supabase prod/dev 이중 프로젝트 관리 종료.
- 포기한 것: Vercel의 자동 preview 도메인 주입(`VERCEL_URL` 계열) — `SITE_URL`
  vars를 env별로 직접 관리. 단일 preview worker라 PR별 격리는 없음
  (last-write-wins).
- 함정:
  - **satori(workers-og)는 자식이 2개 이상인 노드에 `display: flex` 강제** +
    HTML 문자열의 태그 사이 공백도 텍스트 노드로 셈. `compactHtml()` 없이
    마크업을 수정하면 빈 PNG(200, 0 bytes)로 조용히 깨져요.
  - satori는 woff2 미지원 — Pretendard는 **woff** URL(모노레포 경로
    `packages/pretendard/...`)을 써야 해요.
  - `questions.generated.json`을 잊고 콘텐츠만 고치면 `questions:bundle:check`
    게이트가 빌드를 막아요 — `pnpm questions:bundle` 후 커밋.
  - D1은 write 직후 다른 콜로에서 read가 순간적으로 못 볼 수 있어요(복제 지연).
    share 생성→즉시 OG 조회 경로에서 관측됨 — 재시도로 해소되는 수준.
