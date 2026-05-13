# FE 퀴즈 — 핵심 설계 결정

이 문서는 프로젝트의 영구적인 설계 결정과 컨벤션을 저장소 안에 박제해둔 것이에요.
구현 진척도나 PR별 진행 상태가 아니라, **앞으로도 유지될 결정**만 담아요.
결정이 바뀌면 별도 PR로 이 문서를 갱신해 주세요.

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

차후 검토하되 현재는 의도적으로 보류한 항목: AI 면접관 모드(주관식·꼬리질문), 사용자 계정/누적 진척도, 카테고리 확장, Supabase CLI 로컬 dev DB, 콘텐츠/엔진 저장소 분리.

### 매일 자동 출제 (2026-05)

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

## 기술 스택

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **DB**: Supabase (`shares` 테이블 1개)
- **AI**: Anthropic Claude Haiku 4.5 (`claude-haiku-4-5`) — 종합 피드백 전용
- **Rate limit**: Upstash Redis (`@upstash/ratelimit`) — 미설정 시 fail-open
- **Logging**: pino
- **Analytics/Error monitoring**: PostHog (`posthog-js`/`posthog-node`, 키 미설정 시 양쪽 no-op) + `@vercel/analytics`(루트 layout에 `<Analytics />` 마운트로 활성, Vercel 배포에서만 동작)
- **호스팅 가정**: Vercel
- **OG 이미지**: `next/og` 기반 `/r/[slug]/opengraph-image`
- **공유 ID**: `nanoid` 8자리
- **콘텐츠**: `.yaml` 파일, `yaml` 파싱 + `zod` 스키마 검증
- **폰트**: Pretendard (CDN)

## 아키텍처

### 질문 콘텐츠는 YAML, DB는 공유에만

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
새 카테고리를 추가할 때는 `lib/categories.ts`와 `content/questions/<id>/`를 함께 추가하고, `pnpm questions:check`로 검증합니다.

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

### 공개 질문 데이터

브라우저로 내려가는 `PublicQuestion`에는 `answer`, `explanation`이 없습니다.
코드/인라인 코드 표시는 서버에서 HTML로 변환해 `question_html`, `code_html`, `choices[].text_html`로 전달합니다.

### API

| 경로 | 역할 | 특징 |
| --- | --- | --- |
| `POST /api/quiz/submit` | 라운드 채점 | 서버사이드 정답 검증, Shiki HTML 포함 결과 반환 |
| `POST /api/quiz/feedback` | AI 피드백 생성 | Claude Haiku 4.5 plain text 스트리밍 |
| `POST /api/share` | 공유 row 생성 | 서버 재채점 후 저장, slug/url 반환 |

세 라우트 모두 `runtime = "nodejs"`, `dynamic = "force-dynamic"`입니다.

### Supabase 스키마

```sql
create table shares (
  id text primary key,
  question_ids text[] not null,
  score int not null check (score between 0 and 100),
  feedback text not null,
  result_type text not null,
  category_scores jsonb not null,
  created_at timestamptz default now()
);

create index idx_shares_created on shares (created_at desc);
```

현재 정책은 **서버 전용 secret/service-role key만 `shares`에 접근**하는 방향입니다.
초기 anon insert/select 정책은 `20260509000002_lock_down_shares_rls.sql`에서 제거했고, `anon`, `authenticated` 권한도 회수했습니다.

중요:

- 서버 환경변수는 secret/service-role key 사용 — 운영은 `SUPABASE_SECRET_KEY`, 비-운영(preview/local/CI)은 `SUPABASE_DEV_SECRET_KEY`
- 두 키 모두 RLS를 우회하므로 클라이언트 노출 금지
- `lib/supabase.ts`가 `VERCEL_ENV === "production"` 여부로 두 프로젝트를 분기 (NODE_ENV X — `next start`가 로컬에서도 prod NODE_ENV를 세팅하기 때문)
- `NEXT_PUBLIC_SUPABASE_*` 클라이언트 접근 모델이 아님

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

환경변수 표는 `README.md`가 단일 출처예요. `.env.local.example`도 함께 참조해 주세요. Upstash·PostHog·Anthropic은 키가 비면 모두 no-op/fail-open으로 떨어지는 게 기본 원칙이고, 공유/메타 URL의 base는 별도 env 없이 `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` + 요청 헤더 화이트리스트로 도출돼요.

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
- [ ] Supabase anon/publishable key로 `shares` 직접 insert/select 허용

## 디렉토리 컨벤션

```
fe-quiz/
├── app/                         # Next.js App Router
│   ├── api/quiz/submit          # 서버 채점
│   ├── api/quiz/feedback        # AI 피드백 스트리밍
│   ├── api/share                # 공유 생성
│   ├── play/                    # 라운드 UI
│   ├── r/[slug]/                # 공유 결과 + OG 이미지
│   ├── error.tsx                # 라우트 에러 바운더리
│   ├── global-error.tsx         # root layout 에러 바운더리
│   ├── layout.tsx               # 한국어 메타 + Pretendard
│   ├── page.tsx                 # 랜딩
│   └── globals.css              # Tailwind v4 @theme
├── components/
│   └── PostHogProvider.tsx      # 클라이언트 PostHog 부트스트랩
├── content/
│   ├── LICENSE                  # CC BY-SA 4.0
│   ├── README.md                # 콘텐츠 작성자 가이드 (한국어)
│   ├── AGENTS.md                # 콘텐츠 강제 규칙 (영어)
│   └── questions/               # YAML 시드 문제 (카테고리별 폴더)
├── lib/                         # 도메인 로직
│   ├── categories.ts            # 카테고리 단일 출처
│   ├── question.schema.ts       # zod 질문 스키마
│   ├── levels.ts                # 난이도 3단계 단일 출처
│   ├── round.ts                 # 라운드 로드/공개 데이터
│   ├── round-picker.ts          # 라운드 픽커 + ROUND_SIZE 단일 출처
│   ├── grading.ts               # 채점
│   ├── diagnosis.ts             # 진단/페르소나
│   ├── feedback-prompt.ts       # LLM 프롬프트
│   ├── share-store.ts           # shares 저장/조회
│   ├── highlight.ts             # 마크다운/코드 렌더
│   ├── supabase.ts              # 서버 Supabase 클라이언트
│   ├── rate-limit.ts            # Upstash rate limit
│   ├── logger.ts                # pino 싱글턴
│   └── posthog-server.ts        # 서버 PostHog 싱글턴
├── scripts/
│   ├── check-questions.ts
│   ├── check-round.ts
│   └── lint-question-prose.ts   # prose vs code 휴리스틱 검사
├── supabase/
│   ├── AGENTS.md                # 마이그레이션 운영 가이드 (영어)
│   └── migrations/
├── docs/
│   └── DECISIONS.md             # 이 문서 — 영구 설계 결정
├── instrumentation.ts           # Next.js 16 onRequestError → PostHog
├── .env.local.example
├── .mcp.json
├── .nvmrc                       # Node 22
├── biome.json
└── LICENSE                      # MIT
```

마이그레이션 운영 가이드(워크플로 분기, GitHub Secrets, lock-down 주의사항)는 `supabase/AGENTS.md` 참고.
