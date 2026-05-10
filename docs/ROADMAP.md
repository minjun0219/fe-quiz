# FE 퀴즈 — 로드맵

이 문서는 프로젝트의 현재 상태와 다음 작업 컨텍스트를 저장소 안에 박제해둔 것입니다.
다음 PR을 시작할 때마다 여기서 컨텍스트를 복원하세요.
변경사항이 생기면 별도 PR로 이 문서를 갱신해주세요.

## 한 줄 정의

> 친구처럼 퀴즈 내고 친구처럼 피드백하는 프론트엔드 미니게임

한국어 사용 FE 개발자(특히 면접 준비 중인 주니어/미들) 대상.
단톡방에서 친구가 던지는 퀴즈처럼 가볍게 풀고, 끝에 AI가 친구처럼 피드백 주는 미니게임.
MBTI 검사처럼 결과 공유 바이럴이 핵심입니다.

## 현재 구현 상태

- **라운드**: 10문제 랜덤 추출 (`ROUND_SIZE = 10` in `lib/round-picker.ts`), 공유 링크에서 진입하면 같은 문제/같은 순서로 재생
- **난이도**: 3단계(`intro`/`normal`/`challenge`) 선택. 카테고리별 풀이 부족하면 인접 난이도로 자동 대체. `lib/levels.ts`가 단일 출처
- **카테고리**: JavaScript, React, CSS, TypeScript, HTML
- **콘텐츠**: 카테고리별 20문제, 총 100문제 시드
- **문제 형식**: `single_choice`, `multi_choice`
- **채점**: 서버사이드 검증. 클라이언트 라운드 데이터에는 정답/해설 미포함
- **결과**: 총점, 카테고리별 점수, 진단명/페르소나, 타입 코드
- **AI 피드백**: `/api/quiz/feedback`에서 Claude Haiku 4.5 스트리밍 응답
- **공유**: `/api/share`가 서버 재채점 후 `shares` row 생성, `/r/[slug]` 결과 페이지와 OG 이미지 제공. 공유 URL은 요청 헤더(`x-forwarded-host`/`host`) + Vercel 운영 도메인 화이트리스트로 도출하며 그 외 호스트는 `VERCEL_PROJECT_PRODUCTION_URL` 또는 `localhost`로 폴백 (`app/api/share/route.ts`, #36)
- **보안/남용 방지**: Supabase secret key 서버 접근, anon 직접 접근 차단, Upstash rate limit 선택 적용
- **Observability**: PostHog 서버/클라이언트(키 미설정 시 양쪽 no-op) + Next.js `instrumentation.onRequestError`로 미처리 예외 캡처, `app/error.tsx`/`app/global-error.tsx`로 라우트 단 에러 바운더리, Vercel Analytics(루트 layout에서 `<Analytics />` 마운트로 활성, Vercel 배포에서만 데이터 수집)

## 핵심 설계 결정

### 컨셉

- **한 라운드 = 10문제 / 5분 내외** — 완결되는 단위
- **가입 불필요** — 익명으로 바로 시작, 결과 공유 시에만 데이터 저장
- **친구 톤** — "이거 알아? ㅋㅋ" 단톡방 느낌. AI 피드백도 "오, 이건 좀 의외였네" 식으로 가볍게
- **결과 = 진단** — MBTI 결과처럼 공유 가능한 페르소나/타입 코드 제공

### 의도적으로 만들지 않는 것

스트릭, 하트, 티어, 리더보드, 매일 출석, 광고. **Duolingo가 아닌 토스 미니퀴즈/카훗 결**.
학습 압박 요소는 모두 제거합니다.

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

## 환경변수

`.env.local.example` 참조.

| 변수 | 용도 |
| --- | --- |
| `SUPABASE_URL` | 운영 Supabase 프로젝트 URL (`VERCEL_ENV=production` 전용) |
| `SUPABASE_SECRET_KEY` | 운영 서버 전용 secret/service-role key |
| `SUPABASE_DEV_URL` | 비-운영(preview/local/CI) Supabase 프로젝트 URL |
| `SUPABASE_DEV_SECRET_KEY` | 비-운영 서버 전용 secret/service-role key |
| `ANTHROPIC_API_KEY` | Claude 피드백 호출 |
| `UPSTASH_REDIS_REST_URL` | rate limit Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | rate limit Redis REST token |
| `LOG_LEVEL` | pino 로그 레벨 |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key (write-only, 노출 OK) |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog 리전 origin (기본 `https://us.i.posthog.com`) |

Upstash가 미설정되거나 장애가 나면 rate limit은 fail-open입니다. 비용/스팸 보호용이지 보안 경계가 아닙니다.
PostHog 키도 미설정이면 서버/클라이언트 둘 다 no-op으로 떨어집니다.
공유/메타 URL의 base는 별도 env가 아니라 Vercel이 자동 주입하는 `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` + 요청 헤더 화이트리스트로 도출됩니다.

## MVP 범위와 완료 상태

| # | 단계 | 상태 |
| --- | --- | --- |
| 1 | Next.js 16 + TypeScript + Tailwind 프로젝트 초기화 + 로드맵 박제 | ✅ 완료 |
| 2 | Supabase 연결 + `shares` 테이블 마이그레이션 + RLS | ✅ 완료 |
| 3 | `content/questions/` YAML 스키마 + 빌드/검증 파이프라인 | ✅ 완료 |
| 4 | `/play` 라운드 페이지 — 10문제 진행 UI | ✅ 완료 |
| 5 | 서버사이드 정답 검증 API (`/api/quiz/submit`) | ✅ 완료 |
| 6 | 결과 진단 로직 (카테고리별 정확도 → 진단명/타입 코드) | ✅ 완료 |
| 7 | AI 피드백 통합 (Haiku 4.5 스트리밍) | ✅ 완료 |
| 8 | 공유 API + 공유 페이지 (`/r/[slug]`) | ✅ 완료 |
| 9 | Vercel OG 이미지 동적 생성 | ✅ 완료 |
| 10 | 시드 콘텐츠 100문제 작성 | ✅ 완료 |
| 11 | Upstash rate limit + secret-key 기반 Supabase 접근 강화 | ✅ 완료 |
| 12 | 라운드 난이도 3단계 선택 (#25) | ✅ 완료 |
| 13 | Observability — PostHog + Vercel Analytics + `onRequestError` (#38) | ✅ 완료 |

## v2 이후 후보 (지금은 만들지 말 것)

- AI 면접관 모드 (주관식 + 꼬리질문)
- 사용자 계정 / 누적 진척도
- 카테고리 추가
- AI 자동 수집 워크플로우 (GitHub Actions cron)
- Supabase CLI 기반 로컬 dev DB / migration push
- 저장소 분리 (콘텐츠/엔진)

## 톤 & UX 가이드라인

- **카피**: 친구 톤, 격식 X. "다음 문제 ㄱㄱ", "오 정답!", "이건 좀 까다롭지?"
- **폰트**: Pretendard 또는 시스템 폰트
- **색감**: 발랄하되 트래시하지 않게. 광고 느낌 절대 금지
- **모바일 우선**: 단톡방에서 링크 클릭 → 모바일에서 푸는 흐름이 핵심
- **로딩**: AI 피드백 생성 중에는 "친구가 채점 중…" 같은 멘트로 시간을 가리기

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
│   └── questions/               # YAML 시드 문제 100개
├── lib/                         # 도메인 로직
│   ├── categories.ts            # 카테고리 단일 출처
│   ├── question.schema.ts       # zod 질문 스키마
│   ├── levels.ts                # 난이도 3단계 단일 출처
│   ├── round.ts                 # 라운드 선택
│   ├── grading.ts               # 채점
│   ├── diagnosis.ts             # 진단/페르소나
│   ├── feedback-prompt.ts       # LLM 프롬프트
│   ├── share-store.ts           # shares 저장/조회
│   ├── supabase.ts              # 서버 Supabase 클라이언트
│   ├── rate-limit.ts            # Upstash rate limit
│   ├── logger.ts                # pino 싱글턴
│   └── posthog-server.ts        # 서버 PostHog 싱글턴
├── scripts/
│   ├── check-questions.ts
│   └── check-round.ts
├── supabase/
│   └── migrations/
├── docs/
│   ├── ROADMAP.md
│   └── CONTENT_STYLE.md         # 코드 스니펫 표기 컨벤션
├── instrumentation.ts           # Next.js 16 onRequestError → PostHog
├── .env.local.example
├── .mcp.json
├── .nvmrc                       # Node 22
├── biome.json
└── LICENSE                      # MIT
```

## 마이그레이션 적용 방법

`supabase/migrations/*.sql`은 `.github/workflows/migrate.yml`이 `supabase db push`로
자동 적용합니다(Supabase의 GitHub 통합은 미사용). 운영/비-운영 두 프로젝트가
분리되어 있어서(`lib/supabase.ts`) 워크플로가 이벤트별로 분기:

- `pull_request` (PR 열림/푸시) → **dev 프로젝트**에 자동 적용
- `push` to `main` (PR 머지 직후) → **prod 프로젝트**에 자동 적용
- `workflow_dispatch` (수동) → **dev 프로젝트**에 적용 (prod 수동 실행은 의도적으로 금지)

순서를 보장하는 이유: dev 적용 → preview 검증 → main 머지 → prod 적용. prod-first
경로를 두지 않으므로, preview가 옛 스키마를 읽어 머지 전 검증이 무력화되는 일이
없습니다. 반대로 dev 적용을 건너뛰고 main에 머지해도 prod 적용은 안전 — 다만
다음 PR의 preview는 이번 SQL이 dev에 들어와야 정상 동작.

### PR 체크리스트 (마이그레이션 포함 PR 한정)

- [ ] PR 푸시 후 Actions의 `Apply Supabase migrations` (apply 잡) **dev 적용** 성공 확인
- [ ] preview 배포에서 관련 플로우 검증
- [ ] (머지 후) Actions에서 **prod 적용** 성공 확인
- [ ] 운영 도메인 smoke check (공유 1회 생성)

### 필요한 GitHub Secrets

| Secret                         | 용도                           |
|--------------------------------|--------------------------------|
| `SUPABASE_ACCESS_TOKEN`        | supabase CLI 인증 (계정 토큰)  |
| `SUPABASE_PROJECT_REF`         | 운영 프로젝트 ref              |
| `SUPABASE_DB_PASSWORD`         | 운영 DB 비밀번호               |
| `SUPABASE_DEV_PROJECT_REF`     | 비-운영 프로젝트 ref           |
| `SUPABASE_DEV_DB_PASSWORD`     | 비-운영 DB 비밀번호            |

### 주의

`20260509000002_lock_down_shares_rls.sql` 적용 전에는 해당 환경의 secret 키(운영=`SUPABASE_SECRET_KEY`, 비-운영=`SUPABASE_DEV_SECRET_KEY`)가 준비되어 있어야 합니다. SQL만 먼저 적용하면 기존 publishable-key 기반 경로가 `permission denied`로 깨질 수 있습니다.

## 목표

MVP 뼈대와 시드 콘텐츠는 완료된 상태입니다.
이후 작업은 품질 안정화, 배포 환경 점검, 콘텐츠 검수, 공유 바이럴 UX 개선에 집중합니다.
