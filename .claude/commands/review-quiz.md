---
description: 인자로 받은 YAML 파일 각각에 quiz-reviewer를 병렬 spawn해 출처 교차 검증을 수행한다.
argument-hint: "<path1> <path2> ..."
allowed-tools: Task, Read
---

# /review-quiz — 신규 퀴즈 사실성 검수

## 입력

공백으로 구분된 YAML 경로들 (`$ARGUMENTS`). 예:

```
content/questions/react/19-suspense-fallback.yaml content/questions/css/22-aspect-ratio.yaml
```

## 절차

### 1. 인자 파싱

`$ARGUMENTS`를 공백으로 분리. 빈 경우 그대로 종료(보고만).

### 2. quiz-reviewer 병렬 spawn

**반드시 단일 메시지에 모든 `Task` 호출을 동시에 보내**라. 각 파일마다 `quiz-reviewer` sub-agent를 호출한다.

각 Task의 prompt:

```
다음 YAML 파일 1개를 검수해라:

<파일 경로>

검수 절차·출처 라우팅·출력 포맷은 너의 system 지시문을 따른다. 결과 JSON은 `.cache/review/<basename>.json` 에 `Write` 도구로 저장하라. basename은 YAML 파일명에서 확장자(.yaml)만 떼어낸 것이다. 파일 1개만 쓰고 그 외 어떤 파일도 읽거나 쓰지 마라.

`target` 필드에 검수한 YAML 경로를 그대로 적어 두어라(오케스트레이터가 결과를 매핑한다).
```

### 3. 결과 보고

```
## /review-quiz 결과

- content/questions/react/19-suspense-fallback.yaml → approve
- content/questions/css/22-aspect-ratio.yaml       → reject (사유: ..., 출처: ...)
```

## 안전 규칙

- 너는 검수를 직접 하지 마라. 글루만.
- 검수 대상 외 파일을 sub-agent에 알리지 마라.
- YAML을 수정하지 마라(reviewer도 read-only). 거부된 파일 삭제는 워크플로 shell이 처리한다.
