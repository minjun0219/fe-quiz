# 퀴즈 콘텐츠 — 에이전트 가이드

`content/questions/**/*.yaml`을 작성·수정할 때 적용되는 규칙이에요. 렌더는
`lib/highlight.ts`의 `renderQuizMarkdown`이 담당하고, 여기 정리된 컨벤션은
`pnpm questions:check`(prebuild에 연결돼 있음)가 빌드 타임에 강제해요.

사람용 맥락(톤·기여자 온보딩·예시)은 `content/README.md` 참고.

## 한눈에

| 표현 | 표기 방식 |
| --- | --- |
| 단일 식별자 / 키워드 / 한 줄 표현식 / 타입 리터럴 | `` `code` `` (인라인 백틱) |
| 여러 줄 코드 / JSX / 함수 본문 / 멀티라인 객체 | ` ```lang … ``` ` (펜스 블록, 언어 태그 권장) |
| 의미적 강조 | `**bold**` |
| 문제의 메인 코드 샘플 | YAML `code:` 필드 (백틱 없이 plain text) |

## 인라인 백틱

다음은 무조건 `` `…` ``으로 감싸요:

- 단일 식별자(identifier)·키워드·연산자: `` `useEffect` ``, `` `as` ``, `` `:has()` ``
- 속성명·한 줄짜리 CSS 룰: `` `position: sticky` ``, `` `flex-grow: 1; flex-shrink: 1; flex-basis: 0%` ``
- 한 줄 표현식·메서드 호출·타입 리터럴: `` `xs.map(x => x * 2)` ``, `` `{ id: number; name: string }` ``
- 타입 키워드 답안: `` `any` ``, `` `never` ``, `` `void` ``, `` `unknown` ``
- 배열/객체 리터럴 답안: `` `[2, 4, 6, 8]` ``, `` `{ a: 1 }` ``
- HTML 엘리먼트명: `` `<main>` ``, `` `<div role="main">` ``

산문(prose)에 코드 토큰이 섞일 때도 같은 규칙:

```yaml
explanation: |
  `Pick<T, K>`는 `T`에서 키 `K`만 골라낸 새 타입을 만들어요.
```

## 펜스 블록

다음 상황엔 펜스를 써요:

- 여러 줄 함수·분기·전체 코드 블록
- 한 줄이라도 ~60자를 넘겨 모바일에서 임의 줄바꿈이 발생할 때
- JSX 트리, 멀티라인 객체/타입, template literal

언어 태그 권장값: `ts`, `tsx`, `js`, `jsx`, `html`, `css`. 현재 렌더러는
info-string을 파싱만 하고 시각적 렌더링엔 쓰지 않지만, syntax highlighting
도입(#30) 시 즉시 적용되도록 **태그는 반드시 붙여 주세요**.

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

YAML 블록 스칼라(block scalar) 안에서도 펜스는 인식돼요. 들여쓰기 주의 —
첫 줄·끝 줄을 정확히 맞춰서 YAML 파서가 빈 줄을 트리밍하지 않도록.

## 굵게 강조

`**…**`는 의미적 강조 전용:

- `**올바른 설명**`, `**규칙 위반**`, `**컴파일 에러**`

피해야 할 것:

- 코드 토큰을 굵게 감싸지 마세요. 코드는 백틱.
- 지수 연산자 `**`와 인접한 굵게 표기는 양옆에 공백을 둬요. `BOLD_RE` flanking
  규칙(`lib/highlight.ts:39`)이 `Math.PI * shape.r ** 2` 같은 패턴을 굵게로
  잘못 잡지는 않지만, 그런 코드는 펜스로 분리하는 게 안전.

## `code:` 필드

문제의 메인 코드 샘플은 YAML 최상위 `code:` 블록에 백틱 없이 plain text로
넣어요. 렌더가 자동으로 `<pre>`로 감싸 줍니다:

```yaml
code: |
  type Shape =
    | { kind: 'circle'; r: number }
    | { kind: 'square'; s: number }
```

백틱/펜스 규칙은 `question:`, `choices[].text`, `explanation:`에 코드를
끼워넣을 때만 적용돼요.

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

올바른 형태는 위 [인라인 백틱](#인라인-백틱)·[펜스 블록](#펜스-블록) 섹션 참고.

## 검사 자동화

`pnpm questions:check`(prebuild에 연결)가 강제하는 것:

1. `lib/question.schema.ts`의 Zod 스키마
2. `scripts/lint-question-prose.ts`의 prose-vs-code 휴리스틱 — `question:`·
   `choices[].text`·`explanation:` 값에 래핑 안 된 코드 모양 텍스트가 있으면
   비제로 종료.

### opt-out

휴리스틱이 false-positive를 잡는 드문 케이스엔 바로 위 라인에 코멘트 마커:

```yaml
choices:
  # fmt: off-prose
  - id: a
    text: "프로토타입 상속(prototype chain) 자체"
```

마커는 **바로 다음 라인의 한 필드**(같은 키 블록)에만 적용돼요. 매번 한 줄씩
명시적으로 표시 — 무분별한 opt-out을 막는 게 목적이에요.

## 톤(tone)

퀴즈 콘텐츠 톤은 친근한 존댓말(`~합니다` 일변도가 아니라 `~해요` 위주)이에요.
어미 전환 패턴·제약 등 상세는 `content/README.md#톤-가이드`에 정리돼 있어요.
기존 콘텐츠를 수정할 때는 어미만 전환할 것 — 의미·들여쓰기·짧은 코드성 선택지
텍스트는 절대 건드리지 마세요.

## 참고

- 렌더 파이프라인: `lib/highlight.ts`의 `renderQuizMarkdown`
- 인라인 텍스트 호출처: `lib/round.ts:26`, `lib/round.ts:30`, `lib/grading.ts:54`
- 린트 룰: `scripts/lint-question-prose.ts`
- 굵게 flanking 규칙: `lib/highlight.ts:39` (`BOLD_RE`)
