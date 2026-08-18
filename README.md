# FE 퀴즈

> 🍘 누룽지가 퀴즈 내고 한마디 보태주는 프론트엔드 미니게임

한국어 사용 FE 개발자(특히 면접 준비 중인 주니어/미들) 대상.
단톡방에서 슬쩍 던지는 퀴즈처럼 가볍게 풀고, 끝에 누룽지(🍘)가 한마디 보태주는 미니게임.

## 현재 상태

- 한 라운드 = 10문제 / 5분 내외 (`ROUND_SIZE = 10` in `lib/round-picker.ts`)
- 가입 불필요. 결과 공유 시에만 `shares` 테이블에 저장
- 카테고리 5개: JavaScript, React, CSS, TypeScript, HTML
- 시드 문제 100개: 카테고리별 20개
- 문제 형식: 단일 선택(`single_choice`) + 복수 선택(`multi_choice`)
- 라운드 난이도 3단계 선택: 입문 / 보통 / 도전 (`lib/levels.ts` 단일 출처)
- 서버사이드 채점: 정답/해설은 클라이언트 라운드 데이터에 내려가지 않음
- AI 피드백: Claude Haiku 4.5 스트리밍 응답
- 공유: `/r/:slug` 결과 페이지 + OG 이미지(`/r/:slug/og.png`) + 같은 문제 순서로 다시 풀기 (공유 URL은 요청 헤더 + `SITE_URL` 화이트리스트로 도출)
- 보호 장치: D1은 Worker binding으로만 접근(공개 DB 표면 없음), Upstash 기반 rate limit(선택)
- 모니터링: PostHog(에러/이벤트, 키 미설정 시 서버·클라이언트 모두 no-op)
- 호스팅: Cloudflare Workers + D1 ([ADR 0006](./docs/adr/0006-react-router-workers-d1.md))

자세한 컨셉·스택·아키텍처 결정은 [`docs/DECISIONS.md`](./docs/DECISIONS.md) 참고.

## 로컬 실행

패키지 매니저는 **pnpm**을 사용해요. `package.json`의 `packageManager` 필드가 명시되어 있어 corepack이 켜져 있으면 자동으로 잡힙니다.

```bash
nvm use                            # .nvmrc 기준 Node 22
corepack enable                    # pnpm 자동 활성화 (최초 1회)
pnpm install
cp .dev.vars.example .dev.vars     # 서버 secrets (필요한 값만)
cp .env.example .env               # 클라이언트 VITE_* (선택)
pnpm dev                           # vite + workerd (로컬 D1 포함)
```

→ http://localhost:3000

### 환경변수

서버 secrets는 `.dev.vars.example`(로컬) / `wrangler secret put <NAME> --env <env>`(배포), 클라이언트 값은 `.env.example`(`VITE_*`, 빌드 타임 인라인)을 기준으로 설정합니다. `APP_ENV`/`SITE_URL`/`POSTHOG_HOST` 같은 비밀 아닌 vars는 `wrangler.jsonc`이 env별 단일 출처예요.

| 변수 | 위치 | 용도 | 로컬 필수 여부 |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | `.dev.vars` / secret | AI 피드백 생성 | 피드백 사용 시 필수 |
| `UPSTASH_REDIS_REST_URL` | `.dev.vars` / secret | rate limit Redis REST URL | 선택 |
| `UPSTASH_REDIS_REST_TOKEN` | `.dev.vars` / secret | rate limit Redis REST token | 선택 |
| `LOG_LEVEL` | `.dev.vars` / secret | 로그 레벨 (trace…silent) | 선택 |
| `POSTHOG_KEY` | `.dev.vars` / secret | 서버 PostHog (에러 리포팅) | 선택 |
| `VITE_POSTHOG_KEY` | `.env` / 빌드 env | 클라이언트 PostHog project API key (write-only, 노출 OK) | 선택 |
| `VITE_POSTHOG_HOST` | `.env` / 빌드 env | PostHog 리전 origin (기본 `https://us.i.posthog.com`) | 선택 |

공유 링크와 메타/OG base URL은 wrangler env별 `SITE_URL` var + 요청 헤더 화이트리스트로 도출됩니다. 로컬 dev에서는 `localhost:3000`이 폴백입니다.

`ANTHROPIC_API_KEY`, `UPSTASH_*`, `POSTHOG_KEY` 값은 절대 `VITE_` 접두사를 붙이지 말고 클라이언트에 노출하지 마세요. D1은 binding이라 접속 정보 자체가 없습니다.
PostHog 키가 비어 있으면 서버/클라이언트 둘 다 no-op으로 떨어집니다.

## 스크립트

| 명령어 | 용도 |
| --- | --- |
| `pnpm dev` | 개발 서버 (vite + workerd, 로컬 D1) |
| `pnpm build` | 질문/라운드 검사 후 프로덕션 빌드 |
| `pnpm preview` | 빌드된 worker를 로컬 workerd로 실행 |
| `pnpm deploy` / `pnpm deploy:preview` | production / preview 배포 (`CLOUDFLARE_ENV` 빌드 포함) |
| `pnpm lint` | Biome 린트 |
| `pnpm format` | Biome 포맷터 (덮어쓰기) |
| `pnpm check` | Biome + 타입체크 + 질문/번들/라운드 검사 + 테스트 |
| `pnpm typecheck` | wrangler types + react-router typegen + tsc |
| `pnpm questions:check` | `content/questions/**/*.yaml` 스키마/정합성 검사 |
| `pnpm questions:bundle` | Workers 런타임용 `lib/questions.generated.json` 재생성 |
| `pnpm round:check` | 랜덤 라운드 구성 가능 여부 검사 |
| `pnpm test` | Vitest 테스트 |
| `pnpm test:e2e` | Playwright smoke (`E2E_BASE_URL`로 원격 배포 검증 가능) |

## 콘텐츠 추가

콘텐츠는 `content/` 아래 카테고리별 `.yaml` 파일로 관리해요. YAML 예시·톤
가이드·라이선스 안내는 [`content/README.md`](./content/README.md)에, 코드
스니펫 표기·검사 룰 같은 강제 규칙은 [`content/AGENTS.md`](./content/AGENTS.md)에
정리돼 있어요. 추가/수정 후에는 `pnpm questions:check`와 `pnpm questions:bundle`(런타임 번들 재생성)을 돌려 주세요.

## 라이선스

| 대상 | 라이선스 |
| --- | --- |
| 코드 (저장소 전반) | [MIT](./LICENSE) |
| 콘텐츠 (`content/` 하위 — 문제, 해설, 프롬프트) | [CC BY-SA 4.0](./content/LICENSE) |

문제를 가져다 쓰실 때는 출처 표기와 동일 라이선스 적용을 부탁드려요.

## 기여

새 카테고리·문제 형식·공유 구조처럼 UX나 데이터 구조에 영향을 주는 변경은
먼저 이슈로 논의 부탁드려요.

문제 작성 시 코드 스니펫 표기(백틱·펜스) 컨벤션은
[`content/AGENTS.md`](./content/AGENTS.md) 참고. `pnpm questions:check`가
이 컨벤션을 빌드 타임에 강제해요.
