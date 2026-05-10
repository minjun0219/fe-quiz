# FE 퀴즈

> 친구처럼 퀴즈 내고 친구처럼 피드백하는 프론트엔드 미니게임

한국어 사용 FE 개발자(특히 면접 준비 중인 주니어/미들) 대상.
단톡방에서 친구가 던지는 퀴즈처럼 가볍게 풀고, 끝에 AI가 친구처럼 피드백 주는 미니게임.
MBTI 검사처럼 결과 공유 바이럴이 핵심입니다.

## 현재 상태

- 한 라운드 = 5문제 / 3-5분
- 가입 불필요. 결과 공유 시에만 `shares` 테이블에 저장
- 카테고리 5개: JavaScript, React, CSS, TypeScript, HTML
- 시드 문제 100개: 카테고리별 20개
- 문제 형식: 단일 선택(`single_choice`) + 복수 선택(`multi_choice`)
- 서버사이드 채점: 정답/해설은 클라이언트 라운드 데이터에 내려가지 않음
- AI 피드백: Claude Haiku 4.5 스트리밍 응답
- 공유: `/r/[slug]` 결과 페이지 + OG 이미지 + 같은 문제 순서로 다시 풀기
- 보호 장치: Supabase secret key 기반 서버 접근, anon 직접 접근 차단, Upstash 기반 rate limit(선택)

자세한 컨셉/스택/로드맵은 [`docs/ROADMAP.md`](./docs/ROADMAP.md) 참고.

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
| `NEXT_PUBLIC_SITE_URL` | 공유 링크/OG 이미지 base URL | 권장 |
| `SUPABASE_URL` | Supabase 프로젝트 URL | 공유 기능 사용 시 필수 |
| `SUPABASE_SECRET_KEY` | 서버 전용 Supabase secret/service-role key | 공유 기능 사용 시 필수 |
| `ANTHROPIC_API_KEY` | AI 피드백 생성 | 피드백 사용 시 필수 |
| `UPSTASH_REDIS_REST_URL` | rate limit Redis REST URL | 선택 |
| `UPSTASH_REDIS_REST_TOKEN` | rate limit Redis REST token | 선택 |
| `LOG_LEVEL` | pino 로그 레벨 | 선택 |

`SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `UPSTASH_*` 값은 절대 `NEXT_PUBLIC_` 접두사를 붙이지 말고 클라이언트에 노출하지 마세요.

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

문제는 `content/questions/<category>/` 아래 `.yaml` 파일로 관리합니다.
카테고리 목록과 id prefix는 `lib/categories.ts`가 단일 출처입니다.

```yaml
id: js-001
category: javascript
difficulty: medium
type: single_choice
question: 다음 코드의 출력 결과는?
code: |
  console.log(1)
  setTimeout(() => console.log(2))
  Promise.resolve().then(() => console.log(3))
choices:
  - id: a
    text: "1, 2, 3"
  - id: b
    text: "1, 3, 2"
  - id: c
    text: "3, 2, 1"
answer: b
explanation: |
  마이크로태스크 큐가 매크로태스크 큐보다 먼저 처리됩니다.
tags: [event-loop, async]
```

복수 정답 문제는 `type: multi_choice`, `answer: [a, c]`처럼 작성합니다.
추가/수정 후에는 최소 `pnpm questions:check`를 돌려주세요.

## 라이선스

| 대상 | 라이선스 |
| --- | --- |
| 코드 (저장소 전반) | [MIT](./LICENSE) |
| 콘텐츠 (`content/` 하위 — 문제, 해설, 프롬프트) | [CC BY-SA 4.0](./content/LICENSE) |

문제를 가져다 쓰실 때는 출처 표기와 동일 라이선스 적용을 부탁드려요.

## 기여

현재는 MVP 뼈대와 시드 콘텐츠 100문제가 들어간 상태입니다.
새 카테고리/문제 형식/공유 구조처럼 UX나 데이터 구조에 영향을 주는 변경은 먼저 이슈로 논의 부탁드립니다.

문제 작성 시 코드 스니펫 표기(백틱·펜스) 컨벤션은
[`docs/CONTENT_STYLE.md`](./docs/CONTENT_STYLE.md) 참고. `pnpm questions:check`가
이 컨벤션을 빌드 타임에 강제해요.
