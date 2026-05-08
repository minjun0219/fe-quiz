---
description: 카테고리별 sub-agent를 병렬로 spawn해 퀴즈 YAML을 팩트체크하고 직접 수정한다.
argument-hint: "[javascript|react|css|all]"
allowed-tools: Task, Read, Glob, Bash(pnpm questions:check), Bash(pnpm check), Bash(git diff:*), Bash(git status:*)
---

# /factcheck — 퀴즈 자동 팩트체크

대상 카테고리: **$ARGUMENTS** (없거나 `all`이면 javascript / react / css 전체).

## 절차

### 1. 카테고리 결정
- `$ARGUMENTS`가 비어있거나 `all` → `[javascript, react, css]`
- 단일 카테고리(예: `react`) → 해당 카테고리만
- 그 외 입력은 거부하고 사용법을 안내해라.

### 2. sub-agent 병렬 spawn
선택된 각 카테고리마다 `quiz-fact-checker` sub-agent를 `Task` 도구로 호출한다. **반드시 단일 메시지에서 여러 Task 호출을 동시에 보내** 병렬로 실행되게 하라(순차 실행 금지).

각 호출의 prompt는 다음 형식:

> "`content/questions/<category>/` 안의 모든 YAML을 팩트체크하고 문제가 있으면 직접 수정하라. zod 스키마는 `lib/question.schema.ts`에 정의되어 있다. 메타 필드(`id`, `category`, `type`, `difficulty`)는 절대 건드리지 말 것. `explanation`을 수정한 경우 끝에 `(출처: URL)` 인용을 반드시 덧붙여라. 출처 URL이 없는 의심은 수정하지 말고 보고만 한다."

### 3. 검증 게이트
모든 sub-agent가 끝나면 다음을 순차 실행:

```
pnpm questions:check
pnpm check
```

둘 중 하나라도 실패하면:
- **PR 본문에 들어갈 결과 요약을 생성하지 마라.**
- 어떤 sub-agent의 어떤 파일이 깨졌는지 명시하고, 사람이 살펴봐야 한다고 보고하라.
- `git diff`로 깨진 부분을 표시한다.

### 4. 결과 요약 (둘 다 통과한 경우)

다음 형식으로 출력:

```
## /factcheck 결과

- javascript: 변경 N개, 의심 M개
- react: 변경 N개, 의심 M개
- css: 변경 N개, 의심 M개

### 변경 상세
<sub-agent들이 보고한 파일·필드·사유·출처를 카테고리별로 그대로 합친다>

### 의심 (수정하지 않음)
<출처 없어서 수정 못 한 항목들>

### diff 통계
$(git diff --stat content/questions/)
```

이 요약은 그대로 GitHub PR 본문에 들어갈 수 있어야 한다.

## 안전 규칙

- sub-agent는 **자기 카테고리 디렉터리만** 수정한다(다른 카테고리 절대 금지).
- 메타 필드(`id`, `category`, `type`, `difficulty`)는 모든 카테고리에서 변경 금지.
- 변경 사항이 zod 스키마(`choices` 2~6개·중복 금지, `answer` 인덱스 범위)를 위반하지 않아야 한다 — 위반은 step 3에서 자동으로 잡힌다.
- PR을 직접 만들거나 push하지 마라. 그건 워크플로/사용자의 몫이다.
