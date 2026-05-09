# 콘텐츠 스타일 가이드 — 코드 스니펫 래핑

`content/questions/**/*.yaml`을 작성하거나 수정할 때 적용되는 규칙이야. 렌더는
`lib/highlight.ts`의 `renderQuizMarkdown`이 담당하고, 이 문서가 정의한 표기를
그대로 따라가.

## 한눈에

| 무엇을 표시할 때 | 표기 |
| --- | --- |
| 짧은 식별자 / 키워드 / 한 줄 표현식 / 타입 리터럴 | `` `code` `` (인라인 백틱) |
| 여러 줄 코드 / JSX / 함수 본문 / 멀티라인 객체 | ` ```lang … ``` ` (펜스 블록, 언어 태그 권장) |
| 의미적 강조 | `**굵게**` |
| 문제의 메인 코드 샘플 | YAML의 `code:` 필드(plain text, 백틱 없이) |

## 인라인 백틱

다음 경우엔 무조건 `` `…` `` 으로 감싸:

- 단일 식별자, 키워드, 연산자
  - `` `useEffect` ``, `` `as` ``, `` `:has()` ``
- property 이름 / 한 줄짜리 CSS 룰
  - `` `position: sticky` ``, `` `flex-grow: 1; flex-shrink: 1; flex-basis: 0%` ``
- 한 줄 표현식 / 메서드 호출 / 타입 리터럴
  - `` `xs.map(x => x * 2)` ``, `` `{ id: number; name: string }` ``
- 타입 키워드 답안: `` `any` ``, `` `never` ``, `` `void` ``, `` `unknown` ``
- 배열/객체 리터럴 답안: `` `[2, 4, 6, 8]` ``, `` `{ a: 1 }` ``
- HTML 엘리먼트 이름: `` `<main>` ``, `` `<div role="main">` ``

산문(prose) 안에 코드 토큰이 섞일 때도 같은 규칙. 예:

```yaml
explanation: |
  `Pick<T, K>`는 `T`에서 키 `K`만 골라낸 새 타입을 만들어.
```

## 펜스 블록

다음 경우엔 펜스를 써:

- 여러 줄 함수 / 분기 / 코드 블록 전체
- 한 줄이라도 ~60자 초과로 모바일에서 줄바꿈이 곤란할 때
- JSX 트리, 멀티라인 객체 / 타입 / template literal

언어 태그 가이드: `ts`, `tsx`, `js`, `jsx`, `html`, `css`. 현재 렌더러는
info-string을 파싱만 하고 실제 렌더링에는 사용하지 않아 — 태그 유무에 따른
시각적 차이는 없어. 다만 코드 의도를 명시하고 syntax highlight 도입(#30) 시
즉시 적용되도록 **권장**해.

```yaml
choices:
  - id: a
    text: |
      ```ts
      function area(shape: Shape) {
        return Math.PI * shape.r ** 2
      }
      ```
```

YAML 블록 스칼라 안에서도 ` ``` `는 그대로 펜스로 인식돼. 들여쓰기 주의 — YAML
파서가 빈 줄을 트리밍하지 않게 첫 줄과 끝 줄을 정확히 맞춰.

## 굵게 강조

`**…**`는 의미적 강조 전용:

- `**옳은 설명**`, `**규칙을 위반**`, `**컴파일 에러**`

피해:

- 코드 토큰을 굵게 감싸지 마. 코드라면 백틱이 정답.
- 지수 연산자 `**`와 인접한 굵게 표기는 양옆에 공백을 둬. 렌더의
  `BOLD_RE` flanking 규칙(`lib/highlight.ts:39`)이 `Math.PI * shape.r ** 2`
  같은 패턴은 굵게로 잘못 잡지 않지만, 헷갈리지 않게 코드는 펜스로 분리하는 게
  안전해.

## `code:` 필드

문제의 메인 코드 샘플은 YAML 최상위 `code:` 블록을 써. 백틱 없이 plain text로
넣으면 렌더가 자동으로 `<pre>`로 감싸:

```yaml
code: |
  type Shape =
    | { kind: 'circle'; r: number }
    | { kind: 'square'; s: number }
```

`question:`, `choices[].text`, `explanation:` 안에 코드를 끼워넣을 때만 백틱/펜스
규칙이 필요해.

## 하지 말 것 (실패 사례)

```yaml
# ❌ 함수 본문이 prose 폰트로 떨어져 모바일에서 임의 줄바꿈
choices:
  - id: a
    text: |
      function area(shape: Shape) {
        return Math.PI * shape.r ** 2
      }

# ❌ 타입 키워드 답안에 백틱 없음
choices:
  - id: c
    text: "any"

# ❌ CSS 룰을 prose로 남김
choices:
  - id: a
    text: "label > input:checked { background: yellow }"
```

올바른 형태는 위 [인라인 백틱](#인라인-백틱) / [펜스 블록](#펜스-블록) 섹션 참고.

## 검사 자동화

`pnpm questions:check`(prebuild에 연결)이 다음을 강제해:

1. `lib/question.schema.ts`의 Zod 스키마 검증
2. `scripts/lint-question-prose.ts`의 prose-vs-code 휴리스틱 — 래핑되지 않은
   코드 모양 텍스트가 `question:` / `choices[].text` / `explanation:`에 있으면
   비제로 종료

### opt-out

휴리스틱이 false-positive를 잡는 드문 케이스에는 바로 위 라인에 코멘트로
opt-out 마커를 둬:

```yaml
choices:
  # fmt: off-prose
  - id: a
    text: "프로토타입 상속(prototype chain) 자체"
```

마커는 **바로 다음 라인의 한 필드**(같은 키 블록)에만 적용돼. 매번 한 줄씩
명시적으로 표시해. 무분별한 opt-out을 막는 게 목적이야.

## 참고

- 렌더 파이프라인: `lib/highlight.ts` `renderQuizMarkdown`
- 인라인 텍스트 호출처: `lib/round.ts:26`, `lib/round.ts:30`, `lib/grading.ts:54`
- 검사 룰: `scripts/lint-question-prose.ts`
- 굵게 flanking 규칙: `lib/highlight.ts:39` (`BOLD_RE`)
