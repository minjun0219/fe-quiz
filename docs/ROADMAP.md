# FE 퀴즈 — 로드맵 (핸드오프 박제)

이 문서는 프로젝트 핸드오프 시점의 핵심 결정사항을 저장소 안에 박제해둔 것입니다.
다음 PR을 시작할 때마다 여기서 컨텍스트를 복원하세요.
변경사항이 생기면 별도 PR로 이 문서를 갱신해주세요.

## 한 줄 정의

> 친구처럼 퀴즈 내고 친구처럼 피드백하는 프론트엔드 미니게임

한국어 사용 FE 개발자(특히 면접 준비 중인 주니어/미들) 대상.
단톡방에서 친구가 던지는 퀴즈처럼 가볍게 풀고, 끝에 AI가 친구처럼 피드백 주는 미니게임.
MBTI 검사처럼 결과 공유 바이럴이 핵심.

## 핵심 설계 결정

### 컨셉

- **한 라운드 = 5문제 / 3-5분** — 완결되는 단위
- **가입 불필요** — 익명으로 바로 시작, 결과 공유 시에만 데이터 저장
- **친구 톤** — "이거 알아? ㅋㅋ" 단톡방 느낌. AI 피드백도 "오, 이건 좀 의외였네" 식 가볍게
- **결과 = 진단** — MBTI 결과처럼 ("당신의 프론트엔드 컨디션: 브라우저 마스터, 비동기는 아직 약함")

### 의도적으로 만들지 않는 것

스트릭, 하트, 티어, 리더보드, 매일 출석, 광고. **Duolingo가 아닌 토스 미니퀴즈/카훗 결**.
학습 압박 요소 모두 제거.

### 차별화

- 기존 한국어 FE 면접 자료는 GitHub 정적 리포 위주, 2020-2022년에 멈춤
- 영어권 인터랙티브 서비스(BigFrontEnd, GreatFrontEnd)는 한국어 미지원
- **공백 영역**: 한국어 + 인터랙티브 + AI 피드백 + 캐주얼 톤
- **바이럴 핵심**: 결과 공유 OG 이미지 + 친구에게 같은 라운드 보내기

## 기술 스택

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **DB**: Supabase (`shares` 테이블 1개만)
- **AI**: Claude Haiku 4.5 (`claude-haiku-4-5`) — 종합 피드백 전용
- **호스팅**: Vercel (선정 사유: Next.js 네이티브, `next/og` 빌트인, MVP 단계 비용 0)
- **OG 이미지**: `next/og` (Next.js 빌트인, satori 기반)
- **공유 ID**: nanoid (6-8자리)
- **콘텐츠**: `.yaml` 파일, `yaml` 패키지로 파싱 + `zod` 스키마 검증
- **폰트**: Pretendard (CDN)

> 핸드오프 문서 원본은 Next.js 15를 명시했지만, `create-next-app@latest`가 v16을 끌어와
> 현재는 Next.js 16. App Router API는 호환되며 v16에 맞는 패턴(예: route types)을 따릅니다.

## 아키텍처

### 질문 콘텐츠는 .yaml, DB는 공유에만

마크다운 본문이 없고 메타데이터만 다루므로 `.md` frontmatter 대신 그냥 YAML 파일을 사용합니다.
파서/툴체인이 단순해지고(`gray-matter` 불필요, `yaml` 패키지만으로 충분), 스키마 검증도 직접적입니다.

```
content/questions/
  javascript/
    01-event-loop.yaml
    02-closure.yaml
  react/
    01-hooks.yaml
  css/
    01-flexbox.yaml
```

각 `.yaml` 스키마:

```yaml
id: js-001
category: javascript
difficulty: medium
type: multiple_choice  # multiple_choice 만 v1
question: 다음 코드의 출력 결과는?
code: |
  console.log(1)
  setTimeout(() => console.log(2))
  Promise.resolve().then(() => console.log(3))
choices:
  - "1, 2, 3"
  - "1, 3, 2"
  - "3, 2, 1"
answer: 1  # 0-indexed
explanation: |
  마이크로태스크 큐가 매크로태스크 큐보다 먼저 처리됩니다.
tags: [event-loop, async]
```

빌드 타임에 `.yaml` → 정적 JSON 변환. Next.js에 인라인.
파서: `yaml` 패키지(`yaml.parse(fs.readFileSync(...))`).
스키마 검증: `zod` 권장(런타임 + 컴파일타임 타입 동시 확보).

### Supabase 스키마

```sql
create table shares (
  id text primary key,            -- nanoid
  question_ids text[] not null,   -- ['js-001', 'react-003', ...]
  score int not null,
  feedback text not null,
  result_type text not null,      -- '브라우저 마스터' 등
  category_scores jsonb,          -- {javascript: 80, react: 60, css: 100}
  created_at timestamptz default now()
);

create index idx_shares_created on shares (created_at desc);
```

RLS는 익명 INSERT/SELECT만 허용.

### 정답 검증은 서버사이드 (반드시)

- `POST /api/quiz/submit` — Route Handler에서 검증
- 정답은 클라이언트에 절대 안 내려감
- 저장소 공개여도 답안 유출 불가능

### 공유 바이럴 플로우

1. 사용자가 라운드 종료 후 "공유" 클릭
2. `POST /api/share` → shares row 생성 → slug 반환
3. 공유 링크: `https://domain/r/{slug}`
4. 친구가 열면 `/r/{slug}`에서 결과 + AI 피드백 표시 (DB 읽음, 추가 AI 호출 X)
5. "너도 같은 5문제 풀어봐" 버튼 → **동일 순서** 라운드 시작
6. 친구 결과로 새 share 생성 → 루프

**중요**: 같은 라운드를 친구가 풀 때 5문제 순서까지 동일하게.
점수 비교 의미를 살려야 바이럴이 작동합니다.

## MVP 범위 (v1)

- 카테고리 3개: JavaScript, React, CSS/브라우저
- 카테고리당 10문제 = 30문제 시드 (사용자가 직접 작성/제공)
- 객관식만
- 5문제 랜덤 추출 라운드
- 종합 피드백: Haiku 4.5 (프롬프트 캐싱 적용)
- 진단명 매핑: 카테고리별 정확도 → 진단명
- 공유 OG 이미지 동적 생성

## v2 이후 (지금은 만들지 말 것)

- AI 면접관 모드 (주관식 + 꼬리질문)
- 사용자 계정 / 누적 진척도
- 카테고리 추가
- AI 자동 수집 워크플로우 (GitHub Actions cron)
- 저장소 분리 (콘텐츠/엔진)

## 라이선스

- **단일 public 저장소**
- 코드: MIT (`/LICENSE`)
- 콘텐츠 (`content/` 하위 `.yaml` 등): CC BY-SA 4.0 (`content/LICENSE`)

## 비용 추정

Haiku 4.5 기준 ($1/$5 per million tokens):

- 라운드당 input ~3K + output ~800 토큰 ≈ $0.007 (약 10원)
- 1,000명/일 ≈ 월 약 21만원
- 10,000명/일 ≈ 월 약 200만원

프롬프트 캐싱(시스템 프롬프트 부분)으로 90% 추가 절감 가능.

## 작업 순서 (PR 단위)

각 단계 동작 확인 후 다음 진행. 한 PR 한 단계 권장.

| # | 단계 | 상태 |
| --- | --- | --- |
| 1 | Next.js 16 + TypeScript + Tailwind 프로젝트 초기화 + 로드맵 박제 | ✅ 진행 중 (이 PR) |
| 2 | Supabase 연결 + `shares` 테이블 마이그레이션 + RLS | ✅ 진행 중 (이 PR) |
| 3 | `content/questions/` `.yaml` 스키마 + 예시 3개 + `yaml`/`zod` 빌드 파이프라인 | ⬜ |
| 4 | `/play` 라운드 페이지 — 5문제 진행 UI | ⬜ |
| 5 | 서버사이드 정답 검증 API (`/api/quiz/submit`) | ⬜ |
| 6 | 결과 진단 로직 (카테고리별 정확도 → 진단명 매핑) | ⬜ |
| 7 | AI 피드백 통합 (Haiku 4.5, 프롬프트 캐싱) | ⬜ |
| 8 | 공유 API + 공유 페이지 (`/r/[slug]`) | ⬜ |
| 9 | Vercel OG 이미지 동적 생성 (점수 + 진단명 + 캐릭터) | ⬜ |
| 10 | 시드 콘텐츠 30문제 작성 | ⬜ |

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

## 디렉토리 컨벤션

```
fe-quiz/
├── app/                  # Next.js App Router
│   ├── api/              # Route Handlers (Step 5+)
│   ├── layout.tsx        # 한국어 메타 + Pretendard
│   ├── page.tsx          # 랜딩
│   └── globals.css       # Tailwind v4 @theme
├── content/
│   ├── LICENSE           # CC BY-SA 4.0
│   └── questions/        # .yaml 시드 문제 (Step 3+)
│       ├── javascript/
│       ├── react/
│       └── css/
├── lib/                  # 도메인 로직
│   ├── supabase.ts       # 서버 클라이언트 팩토리
│   └── database.types.ts # shares 테이블 TS 타입
├── supabase/
│   └── migrations/       # SQL 마이그레이션 (수동 적용)
├── docs/
│   └── ROADMAP.md        # 이 문서
├── public/
├── .env.local.example
├── .mcp.json             # Supabase MCP server 설정
├── .nvmrc                # Node 22
├── biome.json            # Biome 린터/포맷터
└── LICENSE               # MIT
```

## 마이그레이션 적용 방법

`supabase/migrations/*.sql` 파일들은 자동 적용되지 않아요(GitHub 통합 미사용).
새 마이그레이션이 추가되면:

1. Supabase 대시보드 → SQL Editor 진입
2. 해당 `.sql` 파일 내용 복사 → 붙여넣기 → Run
3. 적용된 시점/파일명을 PR description에 기록

향후 마이그레이션이 늘면 Supabase CLI 도입 검토 (로컬 dev DB + push 명령).

## 목표

**주말 2-3개로 뼈대 완성**, 그 다음부터는 콘텐츠 작성(질문 30개 시드)에 시간 쓸 수 있게.
