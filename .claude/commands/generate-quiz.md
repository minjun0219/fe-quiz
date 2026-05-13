---
description: .cache/batch.json을 읽어 카테고리별 quiz-author를 병렬 spawn한다. 각 author는 .cache/out/<category>.json에 단일 JSON을 쓴다.
argument-hint: ""
allowed-tools: Task, Read, Bash(ls .cache/*:*), Bash(cat .cache/*:*)
---

# /generate-quiz — 카테고리별 신규 문제 생성

## 입력

`.cache/batch.json` — `pnpm questions:prepare-batch` 가 미리 만들어 둔 배열이다. 각 항목 형태:

```jsonc
{
  "category": "react",
  "difficulty": "easy",
  "next_id": "react-019",            // 스크립트가 결정한 다음 id
  "system_prompt": "...",            // quiz-author에 그대로 전달
  "user_prompt": "..."
}
```

## 절차

### 1. 배치 읽기
`.cache/batch.json`을 `Read` 한다. 비어 있으면 그대로 종료(보고만).

### 2. quiz-author 병렬 spawn

배치 엔트리 수만큼 `Task` 를 spawn 한다. 보통은 cron 기본 1개라 1번 호출이지만, 매뉴얼 burst (`categories=react,css,html` 식)에서는 N개가 올라온다. **N ≥ 2 인 경우 반드시 단일 메시지에 모든 `Task` 호출을 동시에 보내** 병렬 실행되게 하라. 각 항목마다 `quiz-author` sub-agent를 호출한다.

각 Task의 prompt는 다음 텍스트를 그대로 보낸다(가공·요약·번역 금지):

```
[배치 항목의 system_prompt]

---

[배치 항목의 user_prompt]

---

# 출력 규칙
- 응답은 위 system_prompt에서 정의한 JSON 객체 1개만.
- 작성이 끝나면 `Write` 도구로 `.cache/out/<category>.json` (category = "react" 등) 한 파일에만 JSON을 저장하라.
- 다른 디렉터리에는 쓰지 마라. 다른 파일을 읽지 마라.
- 출력 텍스트 메시지에는 한 줄로 "wrote .cache/out/<category>.json" 만 남겨도 충분하다.
```

### 3. 결과 보고

다음 형식으로 한 번만 출력해라(N개 행 = 배치 엔트리 수):

```
## /generate-quiz 결과

- react / easy / react-019 → .cache/out/react.json  ✓
```

(burst 예시)

```
- react / easy / react-019 → .cache/out/react.json  ✓
- css   / medium / css-022 → .cache/out/css.json    ✓
- html  / hard / html-008 → .cache/out/html.json    ✗ (사유: ...)
```

## 안전 규칙

- 너는 본문을 직접 작성하지 마라. 글루 역할만.
- `.cache/batch.json` 외의 입력은 읽지 마라.
- `content/`·`lib/`·`scripts/`·기타 워크스페이스 파일에 절대 손대지 마라. 모든 쓰기는 sub-agent가 `.cache/out/`에만.
- 모델·sub-agent가 응답에 마크다운 펜스나 다른 텍스트를 섞었다면 그 카테고리는 실패로 표시하고 다음으로 넘어가라(재시도하지 말 것 — 스크립트가 catch한다).
