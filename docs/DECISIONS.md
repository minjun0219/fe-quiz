# FE 퀴즈 — 핵심 설계 결정

이 문서는 프로젝트의 영구적인 설계 결정과 컨벤션을 저장소 안에 박제해둔 것이에요.
구현 진척도나 PR별 진행 상태가 아니라, **앞으로도 유지될 결정**만 담아요.
결정이 바뀌면 별도 PR로 이 문서를 갱신해 주세요.

개별 결정의 배경·대안·결과는 [`docs/adr/`](./adr/)를 참고해 주세요. 이 문서는
"지금 이 프로젝트가 어떻게 생겼는가"를 빠르게 훑는 살아있는 개요이고, ADR은
"왜 그렇게 정했고 되돌리면 뭐가 깨지는지"를 박제해요.

## 한 줄 정의

> 🍘 누룽지가 퀴즈 내고 한마디 보태주는 프론트엔드 미니게임

한국어 사용 FE 개발자(특히 면접 준비 중인 주니어/미들) 대상.
단톡방에서 슬쩍 던지는 퀴즈처럼 가볍게 풀고, 끝에 누룽지(🍘)가 한마디 보태주는 미니게임.

## 핵심 설계 결정

### 컨셉

- **한 라운드 = 10문제 / 5분 내외** — 완결되는 단위
- **가입 불필요** — 익명으로 바로 시작, 결과 공유 시에만 데이터 저장
- **누룽지 톤** — 단톡방 동료 같은 캐주얼 반말. 너무 풀어지지 않고, 짚을 건 짚어주는 톤
- **결과 = 진단** — MBTI 결과처럼 공유 가능한 페르소나/타입 코드 제공

### 의도적으로 만들지 않는 것

스트릭, 하트, 티어, 리더보드, 매일 출석, 광고. **Duolingo가 아닌 토스 미니퀴즈/카훗 결**.
학습 압박 요소는 모두 제거해요.

차후 검토하되 현재는 의도적으로 보류한 항목: AI 면접관 모드(주관식·꼬리질문), 사용자 계정/누적 진척도, 카테고리 확장, 콘텐츠/엔진 저장소 분리.

### 매일 자동 출제 (2026-05) — [ADR 0001](./adr/0001-daily-quiz-generation-hybrid.md)

GitHub Actions가 **월~금 KST 05:00** 출근길 검수 타이밍에 랜덤 1개 카테고리에 신규 문제 1개를 생성하고 draft PR을 띄워요. (사람 검수 품질이 binding constraint 라서 기본 1/일. 매뉴얼 burst는 `workflow_dispatch`에 `categories=react,css,html` 식으로 N개 명시 가능.) 핵심 분리는 "**결정적인 일은 스크립트, 언어 추론만 sub-agent**":

- 인덱스 빌드·`next_id` 결정·Zod 검증·YAML 직렬화 → `scripts/*.ts` (토큰 0)
- 본문 작성 → `quiz-author` sub-agent (Opus 4.7, 도구는 `Write`만)
- 사양 교차 검증 → `quiz-reviewer` sub-agent (Sonnet 4.6, WebFetch + context7)

상세 설계·데이터 흐름·에지 케이스는 `docs/quiz-generation.md` 참고.

### 차별화

- 기존 한국어 FE 면접 자료는 GitHub 정적 리포 위주, 2020-2022년에 멈춘 자료가 많음
- 영어권 인터랙티브 서비스(BigFrontEnd, GreatFrontEnd)는 한국어 미지원
- **공백 영역**: 한국어 + 인터랙티브 + AI 피드백 + 캐주얼 톤
- **바이럴 핵심**: 결과 공유 OG 이미지 + 친구에게 같은 라운드 보내기

## 기술 스택 — [ADR 0006](./adr/0006-react-router-workers-d1.md)

- **Frontend**: React Router v8 (framework mode) + `@cloudflare/vite-plugin`, React 19, TypeScript, Tailwind CSS v4
- **DB**: Cloudflare D1 (`shares` 테이블 1개, Worker binding으로만 접근)
- **AI**: Anthropic Claude Haiku 4.5 (`claude-haiku-4-5`) — 종합 피드백 전용
- **Rate limit**: Upstash Redis (`@upstash/ratelimit`) — 미설정 시 fail-open
- **Logging**: console 기반 경량 로거 (`lib/logger.server.ts`) → Workers Logs
- **Analytics/Error monitoring**: PostHog (`posthog-js`/`posthog-node`, 키 미설정 시 양쪽 no-op)
- **호스팅**: Cloudflare Workers — production은 `fe-quiz` 워커 + 커스텀 도메인 `fe-quiz.minjun.dev`(workers.dev 라우트 비활성), preview는 `fe-quiz-preview.minjun.workers.dev`
- **OG 이미지**: `workers-og`(satori) 기반 `/r/:slug/og.png` 리소스 라우트
- **공유 ID**: `nanoid` 8자리
- **콘텐츠**: `.yaml` 파일, `yaml` 파싱 + `zod` 스키마 검증 → 빌드 타임에 `lib/questions.generated.json`으로 번들 (Workers엔 런타임 fs가 없음)
- **폰트**: Pretendard (CDN)

## 아키텍처

### 질문 콘텐츠는 YAML, DB는 공유에만 — [ADR 0004](./adr/0004-yaml-content-with-zod-validation.md)

마크다운 본문이 없고 메타데이터만 다루므로 `.md` frontmatter 대신 YAML 파일을 사용합니다.
파서/툴체인이 단순해지고(`gray-matter` 불필요, `yaml` 패키지만 사용), 스키마 검증도 직접적입니다.

```
content/questions/
  javascript/*.yaml
  react/*.yaml
  css/*.yaml
  typescript/*.yaml
  html/*.yaml
```

카테고리 목록과 id prefix는 `lib/categories.ts`가 단일 출처입니다.
새 카테고리를 추가할 때는 `lib/categories.ts`와 `content/questions/<category>/`를 함께 추가하고, `pnpm questions:check`로 검증합니다.

### 질문 YAML 스키마

```yaml
id: js-001
category: javascript
difficulty: medium
type: single_choice # single_choice | multi_choice
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
answer: b # multi_choice는 [a, c] 형태
explanation: |
  마이크로태스크 큐가 매크로태스크 큐보다 먼저 처리됩니다.
tags: [event-loop, async]
```

검증 규칙 핵심:

- `id`는 카테고리 prefix로 시작해야 함 (`js-`, `react-`, `css-`, `ts-`, `html-`)
- choice id/text 중복 금지
- `answer`는 실제 choice id만 참조
- `multi_choice`는 모든 선택지를 정답으로 둘 수 없음

### 공개 질문 데이터 — [ADR 0005](./adr/0005-no-client-answer-exposure.md)

브라우저로 내려가는 `PublicQuestion`에는 `answer`, `explanation`이 없습니다.
코드/인라인 코드 표시는 서버에서 HTML로 변환해 `question_html`, `code_html`, `choices[].text_html`로 전달합니다.

### API

| 경로 | 역할 | 특징 |
| --- | --- | --- |
| `POST /api/quiz/submit` | 라운드 채점 | 서버사이드 정답 검증, 렌더된 HTML 포함 결과 반환 |
| `POST /api/quiz/feedback` | AI 피드백 생성 | Claude Haiku 4.5 plain text 스트리밍 |
| `POST /api/share` | 공유 row 생성 | 서버 재채점 후 저장, slug/url 반환 |

세 라우트 모두 React Router 리소스 라우트(`app/routes/api.*.ts`)의 `action`이고,
URL은 Next 시절 계약 그대로예요(클라이언트 fetch가 하드코딩). GET은 405.

### D1 스키마 — [ADR 0006](./adr/0006-react-router-workers-d1.md)

```sql
CREATE TABLE shares (
  id              TEXT PRIMARY KEY,
  question_ids    TEXT NOT NULL CHECK (json_valid(question_ids)),   -- JSON 배열
  score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  feedback        TEXT NOT NULL,
  result_type     TEXT NOT NULL,
  category_scores TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(category_scores)),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_shares_created_at ON shares (created_at DESC);
```

D1은 Worker binding(`env.DB`)이 유일한 접근 경로라 공개 REST 표면이 없어요 —
구 Supabase 시절의 RLS/GRANT 잠금(ADR 0002)이 통째로 불필요해졌어요.

중요:

- 환경 분리는 wrangler env: 로컬 dev(로컬 sqlite) / `fe-quiz-shares-preview` / `fe-quiz-shares`
- 환경 선택은 **빌드 타임** — 기본(미지정) 빌드 = production, preview만 `CLOUDFLARE_ENV=preview` 명시. `wrangler deploy --env`가 아님 (`wrangler.jsonc` 상단 주석 참고)
- 마이그레이션은 `migrations/*.sql` + `wrangler d1 migrations apply` (CI: `.github/workflows/migrate.yml` — PR→preview, main→prod)

### 공유 바이럴 플로우

1. 사용자가 라운드 종료 후 AI 피드백을 받음
2. 사용자가 공유 클릭
3. `POST /api/share` → 서버가 다시 채점 → `shares` row 생성 → slug/url 반환
4. 공유 링크: `https://domain/r/{slug}`
5. 친구가 열면 `/r/{slug}`에서 결과 + 저장된 피드백 표시 (추가 AI 호출 없음)
6. "나도 같은 문제 풀어보기" → `/play?from={slug}`에서 같은 10문제/같은 순서로 시작
7. 친구 결과로 새 share 생성 → 루프

**중요**: 같은 라운드를 친구가 풀 때 10문제 순서까지 동일해야 합니다.
점수 비교 의미를 살려야 바이럴이 작동합니다.

환경변수 표는 `README.md`가 단일 출처예요. `.dev.vars.example`(서버 secrets)과 `.env.example`(클라이언트 `VITE_*`)도 함께 참조해 주세요. Upstash·PostHog·Anthropic은 키가 비면 모두 no-op/fail-open으로 떨어지는 게 기본 원칙이고, 공유/메타 URL의 base는 wrangler env별 `SITE_URL` var + 요청 헤더 화이트리스트로 도출돼요.

## 톤 & UX 가이드라인

- **카피**: 누룽지 톤, 격식 X. "다음 문제 ㄱㄱ", "오 정답!", "이건 좀 까다롭지?"
- **폰트**: Pretendard 또는 시스템 폰트
- **색감**: 발랄하되 트래시하지 않게. 광고 느낌 절대 금지
- **모바일 우선**: 단톡방에서 링크 클릭 → 모바일에서 푸는 흐름이 핵심
- **로딩**: AI 피드백 생성 중에는 "누룽지가 채점 중…" 같은 멘트로 시간을 가리기

## 함정 체크리스트 (피해야 할 것)

- [ ] 처음부터 사용자 계정 시스템
- [ ] 처음부터 주관식 + 꼬리질문 모드
- [ ] 처음부터 콘텐츠 자동 수집
- [ ] 처음부터 저장소 분리
- [ ] 광고 모듈 (컨셉 자체가 깨짐)
- [ ] 정답을 클라이언트로 내려보내기 (보안 + 컨셉 둘 다 위반)
- [ ] `lib/questions.generated.json`을 클라이언트 코드에서 직접 import (정답 포함 원본)

## 디렉토리 컨벤션

```
fe-quiz/
├── app/                         # React Router framework mode (appDirectory)
│   ├── routes.ts                # 라우트 정의 (config 방식 — 파일 규약 아님)
│   ├── routes/
│   │   ├── home.tsx             # 랜딩
│   │   ├── play.tsx             # 라운드 loader + Suspense 셸
│   │   ├── share.tsx            # /r/:slug 공유 결과 (loader + meta)
│   │   ├── share-og.ts          # /r/:slug/og.png (workers-og)
│   │   ├── api.quiz-submit.ts   # 서버 채점 (action)
│   │   ├── api.quiz-feedback.ts # AI 피드백 스트리밍 (action)
│   │   ├── api.share.ts         # 공유 생성 (action)
│   │   └── robots.ts, sitemap.ts
│   ├── play/                    # 라운드 클라이언트 컴포넌트 (round-runner, result)
│   ├── root.tsx                 # 한국어 메타 + Pretendard + ErrorBoundary(404/500)
│   ├── entry.server.tsx         # SSR 스트리밍 + handleError → PostHog
│   └── app.css                  # Tailwind v4 @theme
├── workers/app.ts               # Worker 진입점 — /ingest 프록시 + RR 핸들러
├── components/
│   └── PostHogProvider.tsx      # 클라이언트 PostHog 부트스트랩
├── content/
│   ├── LICENSE                  # CC BY-SA 4.0
│   ├── README.md                # 콘텐츠 작성자 가이드 (한국어)
│   ├── AGENTS.md                # 콘텐츠 강제 규칙 (영어)
│   ├── INDEX.md                 # 카테고리별 카탈로그 (questions:index 산출)
│   └── questions/               # YAML 시드 문제 (카테고리별 폴더)
├── lib/                         # 도메인 로직 (.server.ts = 서버 전용)
│   ├── categories.ts            # 카테고리 단일 출처
│   ├── question.schema.ts       # zod 질문 스키마
│   ├── levels.ts                # 난이도 3단계 단일 출처
│   ├── questions.generated.json # 빌드 타임 문제 번들 (questions:bundle 산출)
│   ├── questions.server.ts      # 문제 풀 접근자
│   ├── round.server.ts          # 라운드 로드/공개 데이터
│   ├── round-picker.ts          # 라운드 픽커 + ROUND_SIZE 단일 출처
│   ├── grading.ts               # 채점
│   ├── diagnosis.ts             # 진단/페르소나
│   ├── feedback-prompt.ts       # LLM 프롬프트
│   ├── share-store.server.ts    # shares 저장/조회 (D1)
│   ├── highlight.ts             # 마크다운/코드 렌더
│   ├── rate-limit.server.ts     # Upstash rate limit
│   ├── logger.server.ts         # console 기반 로거 + PostHog 포워딩
│   └── posthog-server.server.ts # 서버 PostHog + captureServerError
├── migrations/                  # D1 마이그레이션 (wrangler d1 migrations)
├── scripts/
│   ├── check-questions.ts
│   ├── check-round.ts
│   ├── build-questions-json.ts  # questions.generated.json 생성/검증
│   └── lint-question-prose.ts   # prose vs code 휴리스틱 검사
├── docs/
│   ├── DECISIONS.md             # 이 문서 — 영구 설계 결정 (살아있는 개요)
│   ├── adr/                     # Architecture Decision Records (개별 결정 박제)
│   └── quiz-generation.md       # 자동 출제 워크플로 상세 설계
├── wrangler.jsonc               # Workers 설정 — env(preview/production)별 D1·vars
├── .dev.vars.example            # 서버 secrets 템플릿 (로컬 dev)
├── .env.example                 # 클라이언트 VITE_* 템플릿
├── .nvmrc                       # Node 22
├── biome.json
└── LICENSE                      # MIT
```
