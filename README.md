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
- 공유: `/r/[slug]` 결과 페이지 + OG 이미지 + 같은 문제 순서로 다시 풀기 (공유 URL은 요청 헤더 + Vercel 운영 도메인 화이트리스트로 도출)
- 보호 장치: Supabase secret key 기반 서버 접근, anon 직접 접근 차단, Upstash 기반 rate limit(선택)
- 모니터링: PostHog(에러/이벤트, 키 미설정 시 서버·클라이언트 모두 no-op) + Vercel Analytics(컴포넌트 마운트로 활성, Vercel 배포에서만 데이터 수집)

자세한 컨셉·스택·아키텍처 결정은 [`docs/DECISIONS.md`](./docs/DECISIONS.md) 참고.

## 로컬 실행

패키지 매니저는 **pnpm**을 사용해요. `package.json`의 `packageManager` 필드가 명시되어 있어 corepack이 켜져 있으면 자동으로 잡힙니다.

```bash
nvm use                            # .nvmrc 기준 Node 22
corepack enable                    # pnpm 자동 활성화 (최초 1회)
pnpm install
cp .env.local.example .env.local   # 필요한 값 채우기
pnpm dev
```

→ http://localhost:3000

### 환경변수

`.env.local.example`을 기준으로 설정합니다.

| 변수 | 용도 | 로컬 필수 여부 |
| --- | --- | --- |
| `SUPABASE_URL` | 운영 Supabase 프로젝트 URL (`VERCEL_ENV=production`에서만 사용) | 로컬 불필요 |
| `SUPABASE_SECRET_KEY` | 운영 Supabase secret/service-role key (서버 전용) | 로컬 불필요 |
| `SUPABASE_DEV_URL` | 비-운영(preview/local/CI) Supabase 프로젝트 URL | 공유 기능 사용 시 필수 |
| `SUPABASE_DEV_SECRET_KEY` | 비-운영 Supabase secret/service-role key (서버 전용) | 공유 기능 사용 시 필수 |
| `ANTHROPIC_API_KEY` | AI 피드백 생성 | 피드백 사용 시 필수 |
| `UPSTASH_REDIS_REST_URL` | rate limit Redis REST URL | 선택 |
| `UPSTASH_REDIS_REST_TOKEN` | rate limit Redis REST token | 선택 |
| `LOG_LEVEL` | pino 로그 레벨 | 선택 |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key (write-only, 노출 OK) | 선택 |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog 리전 origin (기본 `https://us.i.posthog.com`) | 선택 |

공유 링크와 메타/OG base URL은 별도 환경변수가 아니라 Vercel이 자동 주입하는 `VERCEL_URL`(메타데이터)·`VERCEL_PROJECT_PRODUCTION_URL`(공유 API) + 요청 헤더 화이트리스트로 도출됩니다. 로컬 dev에서는 `localhost:3000`이 폴백입니다.

`SUPABASE_*_SECRET_KEY`, `ANTHROPIC_API_KEY`, `UPSTASH_*` 값은 절대 `NEXT_PUBLIC_` 접두사를 붙이지 말고 클라이언트에 노출하지 마세요.

Supabase는 운영/비-운영 두 프로젝트로 분리됩니다. `lib/supabase.ts`가 `VERCEL_ENV`로 분기 — Vercel Production 스코프에는 `SUPABASE_URL`/`SUPABASE_SECRET_KEY`만, Preview·Development 스코프와 로컬 `.env.local`에는 `SUPABASE_DEV_URL`/`SUPABASE_DEV_SECRET_KEY`만 넣으세요. "All Environments" 스코프에 운영 키를 두면 preview 빌드가 prod DB를 건드릴 수 있습니다.
PostHog 키가 비어 있으면 서버/클라이언트 둘 다 no-op으로 떨어집니다.

## 스크립트

| 명령어 | 용도 |
| --- | --- |
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 질문/라운드 검사 후 프로덕션 빌드 |
| `pnpm start` | 빌드된 앱 실행 |
| `pnpm lint` | Biome 린트 |
| `pnpm format` | Biome 포맷터 (덮어쓰기) |
| `pnpm check` | Biome 검사 + 질문 검사 + 라운드 검사 + 테스트 |
| `pnpm questions:check` | `content/questions/**/*.yaml` 스키마/정합성 검사 |
| `pnpm round:check` | 랜덤 라운드 구성 가능 여부 검사 |
| `pnpm test` | Vitest 테스트 |

## 콘텐츠 추가

콘텐츠는 `content/` 아래 카테고리별 `.yaml` 파일로 관리해요. YAML 예시·톤
가이드·라이선스 안내는 [`content/README.md`](./content/README.md)에, 코드
스니펫 표기·검사 룰 같은 강제 규칙은 [`content/AGENTS.md`](./content/AGENTS.md)에
정리돼 있어요. 추가/수정 후에는 최소 `pnpm questions:check`를 돌려 주세요.

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
