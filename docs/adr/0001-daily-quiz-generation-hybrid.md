# 0001. 매일 자동 출제 — 스크립트 + sub-agent 하이브리드

- 상태: Accepted
- 결정일: 2026-05-13
- 관련: [docs/quiz-generation.md](../quiz-generation.md), `.github/workflows/generate-questions.yml`, `scripts/prepare-batch.ts`, `scripts/write-generated.ts`, `.claude/agents/quiz-author.md`, `.claude/agents/quiz-reviewer.md`

## 맥락

`content/questions/` 트리는 수기로만 추가돼서 카테고리별 문제 수가 들쭉날쭉하고
증가 속도가 느려요. 라운드 다양성(`ROUND_SIZE=10`)을 유지하고 학습자가 같은
문제를 반복해 만나는 빈도를 줄이려면 일정한 페이스의 신규 문제 유입이 필요해요.

가능한 길은 셋이었어요:

- **A. 스크립트가 Anthropic SDK를 직접 호출** — 형식·결정성은 좋지만 외부 사양
  교차 검증을 위한 도구(WebFetch, context7)를 모델이 못 씀
- **B. claude-code-action에 풀세트 도구 부여** — 사실 정확도는 높지만 모델이
  YAML을 직접 Write하면서 키 순서·들여쓰기·prose 컨벤션이 흔들리고 토큰 비용도
  큼
- **C. 하이브리드** — 결정적·반복적·형식 강제는 스크립트, 언어 추론만 sub-agent

비용 비교(3문제/일 기준 산정 시점): A ~$0.6, B ~$1.9, **C ~$0.8**.

## 결정

**C 하이브리드 채택.** 역할 분리는 다음과 같이 못 박아요:

- 인덱스 빌드·`next_id` 결정·Zod 검증·YAML 직렬화·diff → `scripts/*.ts`
- 문제 본문 작성 → `quiz-author` sub-agent (Opus 4.7, 도구는 `Write`만)
- 외부 사양 교차 검증 → `quiz-reviewer` sub-agent (Sonnet 4.6, WebFetch +
  context7)
- 글루(오케스트레이션) → `/generate-quiz`, `/review-quiz` 슬래시 커맨드

워크플로는 KST 월~금 05:00(출근길 검수 타이밍)에 랜덤 1개 카테고리로 신규
문제 1개를 만들어 draft PR로 올려요. `workflow_dispatch`에 `categories=react,
css,html` 식으로 명시하면 N개 burst.

상세 데이터 흐름·에지 케이스는 [`docs/quiz-generation.md`](../quiz-generation.md)
가 단일 출처예요. 본 ADR은 결정의 골격과 이유만 박제하고, 워크플로/스크립트
세부는 그쪽에서 살아 움직입니다.

## 결과

- 비싼 Opus는 본문 텍스트 생성에만 쓰고 도구 라운드트립을 빼서 토큰을 아껴요.
- 출력은 JSON 한 덩어리만 받고 스크립트가 YAML로 직렬화 → 키 순서·들여쓰기·
  prose lint 형식이 결정적으로 보장돼요.
- 사실성 검증은 더 싼 Sonnet에 도구 풀세트를 부여해 reviewer 단계에 몰빵.
- 사람 검수가 binding constraint이므로 기본은 1문제/일. 멀티 카테고리 인프라는
  그대로 두고 cron의 랜덤 픽 개수만 1로 유지.
- **함정**: author에 도구를 부여하는 옵션은 만들지 않기로 했어요. reject율이
  실제로 높아지면 그때 다시 평가. 그 전에 도구를 붙이면 형식 정확도 보장이
  깨져요.
