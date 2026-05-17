# 0004. 질문 콘텐츠는 YAML + Zod 검증 (마크다운 frontmatter 안 씀)

- 상태: Accepted
- 결정일: 초기 (프로젝트 시작 시)
- 관련: `lib/question.schema.ts`, `content/questions/`, `scripts/check-questions.ts`, `content/AGENTS.md`, [docs/DECISIONS.md](../DECISIONS.md)

## 맥락

퀴즈 한 문제는 사실상 "메타데이터 + 짧은 텍스트 조각들"이에요 — id·카테고리·
난이도·문제 본문·선택지 배열·정답·해설·태그·출처. 본문이라 부를 만한 긴 산문이
없고, 코드 스니펫도 별도 필드(`code`)로 떨어져요.

후보로 검토한 길:

- **A. 마크다운 + YAML frontmatter** — 본문이 마크다운인 콘텐츠 표준 패턴.
  `gray-matter` 같은 파서가 추가로 필요하고, "본문이 비어있는 마크다운 파일"
  이라는 어색한 형태가 됨. 선택지·정답을 frontmatter에 욱여넣으면 결국 YAML과
  같음.
- **B. 순수 YAML** — 파서/툴체인이 단순. `yaml` 패키지 하나면 끝. 스키마 검증도
  바로 객체에 꽂으면 됨.
- **C. JSON** — 사람이 손으로 쓸 콘텐츠는 아님 (멀티라인 문자열·주석 부재).

## 결정

질문 콘텐츠는 **`content/questions/<category>/*.yaml`** 로 저장하고, **Zod**로
강제 검증해요.

- 스키마 정의 단일 출처: `lib/question.schema.ts`의 `QuestionSchema`. discriminated
  union(`single_choice` | `multi_choice`) + `superRefine`으로 cross-field 검증.
- 검증 규칙(핵심):
  - `id`는 카테고리 prefix로 시작 (`js-`, `react-`, `css-`, `ts-`, `html-`,
    이하 카테고리 단일 출처는 `lib/categories.ts`)
  - choice의 `id`/`text` 중복 금지
  - `answer`는 실제 choice id만 참조
  - `multi_choice`는 모든 선택지를 정답으로 둘 수 없음
  - `references[].url`은 https만, 중복 금지
- 게이트: `pnpm questions:check`가 모든 YAML을 Zod로 통과시키고, `prebuild`·
  `check` 스크립트에 묶여 있어 빌드/CI에서 우회 불가.
- prose vs code 스타일은 `content/AGENTS.md`가 단일 출처(인라인 백틱·펜스 블록·
  굵게 사용 규칙).

## 결과

- `gray-matter` 없이 `yaml` 한 패키지만으로 콘텐츠 파이프라인 동작.
- 스키마 위반은 빌드 타임에 잡힘 → 라우트 핸들러는 이미 검증된 객체만 보면 됨.
- 자동 출제 워크플로([ADR 0001](./0001-daily-quiz-generation-hybrid.md))의
  `scripts/write-generated.ts`가 동일 스키마로 safeParse를 돌려, 모델 생성물도
  같은 게이트를 통과해야 머지될 수 있음.
- **포기한 것**: 마크다운 풀파워(본문 내 임의 마크다운 블록, 이미지, 표 등).
  필요하면 별도 필드를 스키마에 추가하는 방향이지, frontmatter 패턴으로 가지
  않아요.
- **함정**: `lib/categories.ts`·`lib/levels.ts`·`lib/round-picker.ts`(`ROUND_SIZE
  = 10`)는 단일 출처. 카테고리를 추가할 때 `lib/categories.ts`와
  `content/questions/<id>/`를 함께 추가하고 `pnpm questions:check`로 검증.
  스키마/단일 출처를 우회해 YAML을 손으로 형식만 맞춰 머지하지 마세요.
