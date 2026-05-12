<!-- BEGIN:nextjs-agent-rules -->
# 이건 네가 아는 Next.js가 아니에요

Next.js 16. API·컨벤션·파일 구조가 학습 데이터(training data)와 다를 수 있어요. 코드를 짜기 전에 `node_modules/next/dist/docs/`의 관련 가이드부터 읽고, deprecation 경고는 그냥 넘기지 말 것.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:tailwind-agent-rules -->
# 이건 네가 아는 Tailwind가 아니에요

Tailwind v4. `tailwind.config.js`는 존재하지 않아요 — 테마 토큰은 `app/globals.css`의 `@theme inline`에 살고, 엔트리는 `@import "tailwindcss"`. config 파일을 새로 만들거나 v3의 plugin/preset 패턴으로 되돌아가지 마세요. 유틸리티를 손대기 전에 `app/globals.css`와 v4 문서를 먼저 확인.
<!-- END:tailwind-agent-rules -->

<!-- BEGIN:zod-agent-rules -->
# 이건 네가 아는 Zod가 아니에요

Zod v4. 에러 형태(error shape)와 일부 API가 v3와 달라요 — `result.error.issues`를 봐야지 `.errors`/`.message`를 보지 말 것. 새 `z.*` 헬퍼는 무조건 v4 문서로 검증부터 하세요. 기존 스키마는 `lib/*.schema.ts`에 있으니까 그 패턴을 그대로 따라 가요.
<!-- END:zod-agent-rules -->

<!-- BEGIN:react-agent-rules -->
# 이건 네가 아는 React가 아니에요

React 19. 이 코드베이스는 서버 컴포넌트(Server Components)가 기본, 클라이언트 인터랙티비티는 드물어요. React 19 문서로 API를 직접 확인하기 전에는 `use()`, `useActionState`, form action에 손대지 마세요 — 학습 데이터가 이 영역은 거의 틀려요.
<!-- END:react-agent-rules -->

<!-- BEGIN:tooling-agent-rules -->
# 툴링: Biome v2, Vitest v4, pnpm 10

ESLint·Prettier 없음 — lint/format은 `biome.json`이 단일 출처(single source of truth)예요. `noConsole`은 앱·라이브러리 코드에서 강제되니 `console` 대신 `lib/logger.ts`(pino) 사용. 단, `scripts/**`·`*.config.*`·`*.test.*`/`*.spec.*`에는 오버라이드로 `console`이 허용돼 있어요. 테스트는 Node 환경 전용(`vitest.config.ts`의 `environment: "node"`) — DOM 테스트는 설정 안 됨. 패키지 매니저는 corepack 기반 pnpm이라 `npm`/`yarn`은 쓰지 마세요.
<!-- END:tooling-agent-rules -->

<!-- BEGIN:project-agent-rules -->
# 추측으로 짜면 틀리는 프로젝트 컨벤션

- **단일 출처(single source of truth)** — 카테고리·난이도·라운드 크기를 바꿀 때는 다음 파일만 손대요:
  - `lib/categories.ts` (카테고리 목록 + id prefix)
  - `lib/levels.ts` (난이도 3단계)
  - `lib/round-picker.ts` (`ROUND_SIZE = 10`)
- **`server-only` 경계**: `lib/supabase.ts`, `lib/rate-limit.ts`, `lib/posthog-server.ts`, `lib/logger.ts`는 모두 `import "server-only"` 가드를 갖고 있어요. 클라이언트 컴포넌트에서 절대 import 금지.
- **환경 분기는 `VERCEL_ENV`이지 `NODE_ENV`가 아님** — `next start`가 로컬에서도 `NODE_ENV=production`을 세팅하기 때문에, NODE_ENV로 분기하면 로컬 prod 빌드가 운영 Supabase를 친다. `lib/supabase.ts` 참고.
- **클라이언트에 정답 노출 금지**: `PublicQuestion` 타입에서 `answer`·`explanation`을 의도적으로 제거. 채점은 서버사이드. 브라우저로 내려가는 어떤 데이터에도 정답 필드를 추가하지 마세요.
- **선택적(optional) 연동은 env 미설정 시 no-op / fail-open**: Upstash rate limit, PostHog(서버 + 클라이언트), Anthropic. 이걸 hard requirement로 바꾸지 마세요.
- **YAML 콘텐츠는 스키마 검증 강제**: `content/questions/` 아래를 손댔으면 `pnpm questions:check` 실행. 산문(prose) vs 코드 스타일은 `content/AGENTS.md`에 정리.

심화 맥락이 필요하면 작업 전에 `docs/DECISIONS.md`와 `content/AGENTS.md`를 먼저 읽어 주세요.
<!-- END:project-agent-rules -->
