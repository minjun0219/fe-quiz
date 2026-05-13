# 매일 자동 출제 — 설계 결정과 워크플로

> 2026-05-13 결정. 변경 시 이 문서를 같은 PR에서 갱신해 주세요.
>
> **revision (2026-05-13)**: 기본 출제량을 3문제 → **1문제/일**로 줄임. 사람 검수 품질이 binding constraint 라서. 멀티 카테고리 인프라는 그대로 두고 워크플로 cron 의 랜덤 픽 개수만 1로 변경 — `workflow_dispatch`에 `categories=react,css,html`을 명시하면 N개 burst 도 그대로 작동함.

## 무엇을 푸는가

`content/questions/` 트리는 수기로만 추가돼 카테고리별 문제 수가 들쭉날쭉하고 증가 속도가 느려요. 라운드 다양성(`ROUND_SIZE=10`)을 유지하고 학습자가 같은 문제를 반복해 만나는 빈도를 줄이려면 **매일 일정한 페이스의 신규 문제 유입**이 필요해요.

이 워크플로는 GitHub Actions 스케줄(KST 09:00)에서 **신규 1문제**(랜덤 1개 카테고리 × 1문제)를 자동 생성하고, draft PR로 띄워 사람이 검수 후 머지하는 흐름이에요. 매뉴얼 실행에서는 `categories=cat1,cat2,...` 식으로 한 번에 N개 burst 가능 — `prepare-batch.ts`·`write-generated.ts`·sub-agent 들이 N개를 그대로 받습니다.

## 핵심 결정: 결정적인 일은 스크립트, 언어 추론만 모델

| 부류 | 처리 주체 |
|---|---|
| 결정적·반복적·형식 강제 (인덱스, id, YAML 직렬화, Zod 검증, diff) | **스크립트 / 워크플로 shell** |
| 창의·언어 출력 (문제 본문 작성) | **`quiz-author` sub-agent (Opus 4.7, 도구는 `Write`만)** |
| 외부 사양 교차 검증 (MDN/React docs 인용 정확도) | **`quiz-reviewer` sub-agent (Sonnet 4.6, WebFetch + context7)** |
| 글루 (오케스트레이션) | **`/generate-quiz`, `/review-quiz` 슬래시 커맨드** |

### 이 분리의 노림수

- 비싼 Opus를 **본문 텍스트 생성에만** 쓰고 도구 라운드트립을 빼서 토큰 절약.
- 출력은 **JSON 한 덩어리**만 받아 스크립트가 YAML 직렬화 → 키 순서·들여쓰기·prose lint 형식 보장.
- 사실성 검증은 더 싼 Sonnet에 도구 풀세트를 부여해서 reviewer 단계에 몰빵.

### 비교 (참고)

아래 표는 아키텍처 결정 시점(3문제 회차)을 기준으로 산정한 값. 현재 기본은 1문제이므로 모든 비용을 `÷3` 으로 보면 됨.

| 방식 | 일일 비용 (3문제 기준) | 1문제 기준 | 형식 정확도 | 사실 정확도 | 결정성 |
|---|---|---|---|---|---|
| A. 스크립트가 SDK 직접 호출 | ~$0.6 | ~$0.2 | ↑ | ↓ (도구 없음) | ↑ |
| B. claude-code-action에 풀세트 도구 부여 | ~$1.9 | ~$0.63 | ↓ (모델이 직접 Write) | ↑ | ↓ |
| **현재 채택: 하이브리드** | **~$0.8** | **~$0.27** | **↑** (스크립트 직렬화) | **↑** (reviewer만 도구) | **↑** (시드+사전 빌드 프롬프트) |

## 사용자 확정 사항

- 카테고리: 8개 중 매일 **랜덤 1개** (기본). 매뉴얼 실행 시 `categories=cat1,...` 식으로 N개 명시.
- 출제: **신규**만 (변형 모드 없음)
- 모델: 작성 = **Opus 4.7** (`claude-opus-4-7`), 리뷰 = **Sonnet 4.6** (`claude-sonnet-4-6`)
- 스케줄: 매일 **KST 09:00** (`cron: '0 0 * * *'`) + `workflow_dispatch`
- 구조: 슬래시 커맨드 + author/reviewer sub-agent 분리
- 인덱스: `content/INDEX.md`를 git 커밋 + `prebuild`에서 stale 검증

## 데이터 흐름 (1일 1회, 기본)

```
[워크플로 shell]
  └─ shuf --random-source=run_id -n 1 → cats = "react"
     # 매뉴얼 burst: workflow_dispatch에 categories="react,css,html" → 그대로 3개 처리

[scripts/prepare-batch.ts <cats> <difficulties>]
  ├─ loadAllQuestions() → 카테고리별 next_id, 인덱스 발췌
  ├─ Read lib/question.schema.ts → ChoiceSchema~QuestionSchema 발췌
  ├─ Read content/AGENTS.md → prose 컨벤션 (그대로 박음)
  └─ Write .cache/batch.json
       [
         { category, difficulty, next_id, system_prompt, user_prompt },
         ...
       ]

[claude-code-action] → /generate-quiz
  └─ 오케스트레이터 (Task 글루)
       ├─ Read .cache/batch.json
       └─ Task × N (단일 메시지에 병렬, 보통 1) → quiz-author (Opus, tools: Write 만)
             입력: 사전 빌드된 system+user
             출력: 단일 JSON → .cache/out/<category>.json

[scripts/write-generated.ts]
  ├─ .cache/out/*.json 읽기
  ├─ id/category/difficulty 스크립트가 강제 주입 (모델 출력 폐기)
  ├─ slug 정규화 → [a-z0-9-]{1,40}, 미준수 시 auto-<id>
  ├─ QuestionSchema.safeParse → 실패한 카테고리는 skip
  ├─ 키 순서 강제: id → category → difficulty → type → question → code → choices → answer → explanation → references → tags
  └─ yaml.stringify → content/questions/<cat>/<NN>-<slug>.yaml

[워크플로 shell] pnpm questions:index && pnpm questions:check
  → 형식·prose lint·id 유일성·라운드 invariant 게이트

[claude-code-action] → /review-quiz <file1> [<file2> ...]
  └─ Task × N (병렬) → quiz-reviewer (Sonnet, WebFetch + context7)
        파일별 1개 검수
        출력: .cache/review/<basename>.json { target, verdict, reason, citations[] }

[워크플로 shell]
  ├─ jq로 verdict=reject 추출 → rm
  └─ pnpm questions:index 재실행 (INDEX.md 갱신)

[워크플로 shell] pnpm check  (최종 게이트: biome + questions:check + index:check + round:check + test)

[peter-evans/create-pull-request@v6]
  └─ draft PR
       add-paths: content/questions/**, content/INDEX.md
       labels: generated, automated
       body: scripts/build-pr-body.ts 산출 (카테고리·verdict·citations 표)
```

## 결정적 부분 (스크립트가 책임짐)

### `scripts/build-questions-index.ts`

`content/INDEX.md`는 카테고리별 카탈로그(id + 난이도 + tags + 본문 첫 줄)만 담아요.

- **정답·해설·choices·references는 인덱스에 절대 미포함** — PR 검토자가 정답을 미리 보지 않게 + 향후 인덱스를 다른 모델이 컨텍스트로 받더라도 정답 누수가 없음.
- `--check`: 메모리에 빌드한 결과와 디스크 파일이 다르면 exit 1. `prebuild`/`check`에서 강제.

### `scripts/prepare-batch.ts`

인자: `<cat1,cat2,cat3> [<diff1,diff2,diff3>]` (난이도 기본 `easy,medium,hard`).

산출 `.cache/batch.json` 각 엔트리:
- `next_id`: 스크립트가 결정. 모델은 받기만(주입은 `write-generated.ts`가 다시 강제).
- `system_prompt`: 역할 + JSON 출력 계약 + Zod 스키마 발췌(`ChoiceSchema`~`QuestionSchema`) + `content/AGENTS.md` 그대로 + 톤·안전 규칙.
- `user_prompt`: 카테고리·난이도·next_id 안내 + 같은 카테고리의 기존 문제 카탈로그 + 다른 각도로 출제 요청.

### `scripts/write-generated.ts`

- 입력: `.cache/out/<category>.json` (author 응답).
- 처리:
  1. JSON 파싱 실패 / 객체 아님 → 그 카테고리만 skip + stderr 보고.
  2. `id`·`category` 키는 author 응답에서 강제로 제거하고 batch 값으로 다시 주입.
  3. `difficulty`도 batch 값으로 덮어쓰기(모델이 자기 멋대로 바꾸지 못하게).
  4. `slug` 정규화: `[a-z0-9-]{1,40}`, 빈 값/오류 시 `auto-<next_id>`.
  5. `QuestionSchema.safeParse` — 실패 시 issue 경로 보고하고 skip.
  6. 키 순서 재배열 후 `yaml.stringify(obj, { lineWidth: 0, blockQuote: "literal", sortMapEntries: false })`.
  7. `content/questions/<category>/<NN>-<slug>.yaml`에 write (NN = `next_id` 번호 2자리 패딩).
- 모든 카테고리가 실패하면 exit 2 → 워크플로가 자연스럽게 PR 미생성.

### `scripts/build-pr-body.ts`

`.cache/batch.json` + `.cache/review/*.json` 를 머지해 PR body를 markdown으로 stdout. 워크플로가 `.cache/pr-body.md`로 리다이렉트한다.

### `package.json` 변경

```jsonc
{
  "prebuild": "pnpm questions:check && pnpm questions:index:check && pnpm round:check",
  "check": "biome check . && pnpm questions:check && pnpm questions:index:check && pnpm round:check && pnpm test",
  "questions:index": "tsx scripts/build-questions-index.ts",
  "questions:index:check": "tsx scripts/build-questions-index.ts --check",
  "questions:prepare-batch": "tsx scripts/prepare-batch.ts",
  "questions:write-generated": "tsx scripts/write-generated.ts"
}
```

## 모델 부분 (sub-agent)

### `.claude/commands/generate-quiz.md`

- `allowed-tools: Task, Read, Bash(ls .cache/*:*), Bash(cat .cache/*:*)`
- `.cache/batch.json` Read → 각 항목마다 `Task` 1번 호출(단일 메시지에 3개 → 병렬)
- 각 Task의 prompt = 배치 항목의 `system_prompt` + `user_prompt` + "Write로 `.cache/out/<category>.json`만 만들어라"
- 오케스트레이터 자신은 본문을 만들지 않는다 — 글루 역할만.

### `.claude/agents/quiz-author.md`

- `model: claude-opus-4-7`
- `tools: Write` — 단 한 번 호출해 `.cache/out/<category>.json`에 JSON 한 덩어리만 저장.
- **외부 도구 호출 금지** (라운드트립 비용·시간 절약). 시스템·유저 프롬프트에 박힌 스키마·컨벤션·인덱스만 보고 작성.
- `id`/`category`/`slug`를 JSON에 넣지 말 것(스크립트가 주입). `difficulty`는 prompt 지시에 따라.
- `answer`는 `choices[].id` 중 하나(들). **인덱스 아님.**

### `.claude/commands/review-quiz.md`

- `allowed-tools: Task, Read`
- 인자로 받은 경로마다 `Task` 1번(병렬). reviewer 응답을 `.cache/review/<basename>.json`에 Write.

### `.claude/agents/quiz-reviewer.md`

- `model: claude-sonnet-4-6`
- `tools: Read, WebFetch, WebSearch, mcp__context7__*, Write`
- 출처 라우팅 표(JS/CSS/HTML/Web API는 MDN, React/Next/TS는 context7) 내장.
- 출력 = `.cache/review/<basename>.json`:
  ```json
  { "target": "content/questions/<cat>/NN-slug.yaml",
    "verdict": "approve" | "reject",
    "reason": "한 줄 요약",
    "citations": ["https://..."] }
  ```
- **수정 금지** (`Edit` 권한 없음). reject 시 워크플로 shell이 `rm`.

## 워크플로 `.github/workflows/generate-questions.yml`

- 트리거: `schedule: 0 0 * * *` (KST 09:00) + `workflow_dispatch` (categories/difficulties/dry_run 옵션)
- 무한 루프 방지: `if: !startsWith(github.head_ref, 'claude/generate-quiz-')`
- 동시성: `quiz-generate` 그룹 (cancel-in-progress: false)
- 안전장치: `content/` 외부 diff 감지 시 즉시 fail
- 변경 0개 or 모든 카테고리 reject: peter-evans가 PR 미생성, 워크플로는 success

## Fail-open / 에지 케이스

- **`ANTHROPIC_API_KEY` 없음**: claude-code-action step 실패 → PR 미생성 (다음 날 재시도).
- **author 1개 실패**: `.cache/out/<cat>.json` 미생성 → `write-generated.ts`가 해당 카테고리만 skip. 나머지 2개로 PR 진행.
- **JSON 파싱 실패**: `write-generated.ts`가 해당 응답 폐기 + stderr 보고.
- **Zod 실패**: 같은 처리. 카테고리 누락.
- **reviewer reject**: 해당 파일 `rm` → 인덱스 재빌드 → 그 카테고리는 이번 회차 결손. 다음 날 재시도.
- **모든 reviewer가 reject**: 변경 없음 → PR 미생성. 워크플로는 success.
- **id/슬러그 충돌**: 스크립트가 결정하므로 0.
- **stale INDEX.md**: `prebuild`/`check`/CI에서 `questions:index:check`로 차단. PR 직전에 워크플로가 강제로 다시 빌드.
- **content/ 외부 수정**: diff 가드가 즉시 fail.

## 명시적 비목표

- 기존 문제 변형(remix) 모드 도입하지 않음.
- `lib/categories.ts`·`lib/levels.ts`·`ROUND_SIZE` 등 단일 출처 상수 수정하지 않음.
- 클라이언트 컴포넌트·API 라우트·DB 수정 없음.
- 인덱스 포맷은 단순 markdown으로 시작. JSON으로 추상화는 필요해질 때.
- 출제 정책(빈도/분포)은 워크플로 cron·shell·`prepare-batch.ts`에 직접 박음. 별도 config 파일 X.
- author에 도구를 부여하는 옵션은 만들지 않음. reject율이 실제로 높아지면 그때 결정.

## 재사용 자산 (수정 없이 read만)

| 파일 | 용도 |
|---|---|
| `lib/categories.ts` | 카테고리 목록·id prefix |
| `lib/question.schema.ts` | `prepare-batch`가 텍스트로 인용, `write-generated`가 safeParse |
| `lib/load-questions.ts` | `build-questions-index`/`prepare-batch`가 호출 |
| `content/AGENTS.md` | `prepare-batch`가 prose 컨벤션 발췌해 system에 박음 |
| `.github/workflows/quiz-factcheck.yml` | 워크플로 골격·안전장치 패턴 |
| `.mcp.json` | claude-code-action에 그대로 전달(context7) |

## 검증 방법

1. **로컬 인덱스**: `pnpm questions:index && pnpm questions:index:check && pnpm prebuild`
2. **로컬 prepare (단일)**: `pnpm questions:prepare-batch react` → `.cache/batch.json` 엔트리 1개
3. **로컬 prepare (burst)**: `pnpm questions:prepare-batch react,css,html` → 3개 엔트리 + 카테고리별 next_id 다 다름
4. **로컬 write (mock)**: `.cache/out/<cat>.json`에 손으로 만든 JSON 1~2개 넣고 `pnpm questions:write-generated` → YAML 형식·키 순서·Zod 통과 확인
5. **워크플로 manual dry-run (1개 경로)**: `categories=""` 두고 `dry_run=true` → 로그에서 무작위 1개 카테고리 선택·verdict 확인, PR 미생성 검증
6. **워크플로 manual burst (N개 경로)**: `categories=react,css,html`, `dry_run=true` → 3개 모두 처리되는 경로 작동 확인
7. **실제 dry_run=false**: draft PR + `check.yml` 통과 확인
8. **사람 검수**: 정답·해설·출처 직접 확인 → ready-for-review → 머지
9. **스케줄**: 머지 후 다음 09:00 KST 자동 실행 확인
