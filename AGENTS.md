<!-- BEGIN:react-router-agent-rules -->
# 이건 Next.js가 아니에요 — React Router + Cloudflare Workers

React Router v8 framework mode + `@cloudflare/vite-plugin`. Next.js 파일 규약(page/layout/loading/route.ts)은 여기 없어요 — 라우트는 `app/routes.ts` config가 단일 출처, 서버 로직은 loader/action, worker 진입점은 `workers/app.ts`. 학습 데이터의 Remix/RR v7 지식과도 다를 수 있으니 API가 애매하면 `node_modules/react-router/` 타입과 공식 문서로 확인부터.

**배포 환경 선택은 빌드 타임**: vite 빌드가 env를 구워요 — **기본(미지정) = production**이고, preview만 `CLOUDFLARE_ENV=preview`를 명시해요 (`pnpm deploy:preview`). 로컬 dev 오버라이드는 `.dev.vars`. `wrangler deploy --env`는 무시돼요 (`wrangler.jsonc` 상단 주석 참고).
<!-- END:react-router-agent-rules -->

<!-- BEGIN:tailwind-agent-rules -->
# 이건 네가 아는 Tailwind가 아니에요

Tailwind v4. `tailwind.config.js`는 존재하지 않아요 — 테마 토큰은 `app/app.css`의 `@theme inline`에 살고, 엔트리는 `@import "tailwindcss"` + `@tailwindcss/vite` 플러그인. config 파일을 새로 만들거나 v3의 plugin/preset 패턴으로 되돌아가지 마세요. 유틸리티를 손대기 전에 `app/app.css`와 v4 문서를 먼저 확인.
<!-- END:tailwind-agent-rules -->

<!-- BEGIN:zod-agent-rules -->
# 이건 네가 아는 Zod가 아니에요

Zod v4. 에러 형태(error shape)와 일부 API가 v3와 달라요 — `result.error.issues`를 봐야지 `.errors`/`.message`를 보지 말 것. 새 `z.*` 헬퍼는 무조건 v4 문서로 검증부터 하세요. 기존 스키마는 `lib/*.schema.ts`에 있으니까 그 패턴을 그대로 따라 가요.
<!-- END:zod-agent-rules -->

<!-- BEGIN:react-agent-rules -->
# React 19 + React Router SSR

RSC가 아니에요 — 라우트 컴포넌트는 서버에서 SSR된 뒤 클라이언트에서도 렌더돼요. 그래서 라우트 컴포넌트가 직접 부르는 모듈은 브라우저 안전해야 하고, 서버 전용 코드는 `.server.ts` 파일로 격리해 loader/action에서만 import해요. `"use client"` 지시자는 이 코드베이스에 없어요.
<!-- END:react-agent-rules -->

<!-- BEGIN:tooling-agent-rules -->
# 툴링: Biome v2, Vitest v4, pnpm 10, wrangler 4

ESLint·Prettier 없음 — lint/format은 `biome.json`이 단일 출처(single source of truth)예요. `noConsole`은 앱·라이브러리 코드에서 강제되니 `console` 대신 `lib/logger.server.ts` 사용. 단, `scripts/**`·`*.config.*`·`*.test.*`/`*.spec.*`·`lib/logger.server.ts`에는 오버라이드로 `console`이 허용돼 있어요. 테스트는 Node 환경 전용(`vitest.config.ts`의 `environment: "node"`) — DOM 테스트는 설정 안 됨, `cloudflare:workers`를 import하는 `.server.ts` 모듈은 vitest에서 실행 불가(순수 로직을 분리해서 테스트). 패키지 매니저는 corepack 기반 pnpm이라 `npm`/`yarn`은 쓰지 마세요. 로컬 dev는 `pnpm dev`(vite + workerd), 게이트는 `pnpm check`.
<!-- END:tooling-agent-rules -->

<!-- BEGIN:project-conventions -->
# 추측으로 짜면 틀리는 프로젝트 컨벤션

- **단일 출처(single source of truth)** — 카테고리·난이도·라운드 크기를 바꿀 때는 다음 파일만 손대요:
  - `lib/categories.ts` (카테고리 목록 + id prefix)
  - `lib/levels.ts` (난이도 3단계)
  - `lib/round-picker.ts` (`ROUND_SIZE = 10`)
- **`.server.ts` 경계**: `lib/{questions,round,share-store,rate-limit,logger,posthog-server}.server.ts`는 서버 전용. 클라이언트 컴포넌트에서 절대 import 금지 — RR 빌드가 에러로 잡아줘요.
- **환경 분기는 `APP_ENV`(wrangler vars)이지 `NODE_ENV`가 아님** — 로컬/preview/production이 wrangler env로 갈리고, D1 binding·`SITE_URL`도 env별로 달라요. `wrangler.jsonc` 참고.
- **클라이언트에 정답 노출 금지**: `PublicQuestion` 타입에서 `answer`·`explanation`을 의도적으로 제거. 채점은 서버사이드. `lib/questions.generated.json`(정답 포함 원본)을 클라이언트 코드에서 직접 import하는 것도 같은 위반이에요.
- **선택적(optional) 연동은 env 미설정 시 no-op / fail-open**: Upstash rate limit, PostHog(서버 + 클라이언트), Anthropic. 이걸 hard requirement로 바꾸지 마세요.
- **YAML 콘텐츠는 스키마 검증 강제**: `content/questions/` 아래를 손댔으면 `pnpm questions:check` + **`pnpm questions:bundle`**(런타임 번들 재생성 — 잊으면 `questions:bundle:check`가 빌드를 막아요) 실행. 산문(prose) vs 코드 스타일은 `content/AGENTS.md`에 정리.
- **OG 이미지(satori) 함정**: `app/routes/share-og.ts`의 HTML은 자식 2개 이상인 노드에 `display: flex`가 필수고 태그 사이 공백도 자식으로 세요 — `compactHtml()`을 우회하지 마세요. 폰트는 woff(woff2 미지원).

심화 맥락이 필요하면 작업 전에 `docs/DECISIONS.md`와 `docs/adr/`(특히 [0006](docs/adr/0006-react-router-workers-d1.md)), `content/AGENTS.md`를 먼저 읽어 주세요.
<!-- END:project-conventions -->
