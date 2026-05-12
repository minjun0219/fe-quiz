# 콘텐츠 작성 가이드

이 폴더는 FE 퀴즈의 문제 콘텐츠가 사는 곳이에요. 카테고리별 폴더 아래
`.yaml` 파일로 한 문제 한 파일씩 관리해요.

```
content/questions/
  javascript/*.yaml
  react/*.yaml
  css/*.yaml
  typescript/*.yaml
  html/*.yaml
  browser/*.yaml
  performance/*.yaml
  nextjs/*.yaml
```

카테고리 목록과 id prefix는 `lib/categories.ts`가 단일 출처예요. 현재 prefix는
`js-`, `react-`, `css-`, `ts-`, `html-`, `browser-`, `perf-`, `next-` 8종.
새 카테고리를 추가할 일이 생기면 `lib/categories.ts`부터 시작해 주세요.

## YAML 예시

```yaml
id: js-001
category: javascript
difficulty: medium
type: single_choice
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
answer: b
explanation: |
  마이크로태스크 큐가 매크로태스크 큐보다 먼저 처리돼요.
tags: [event-loop, async]
```

복수 정답 문제는 `type: multi_choice`, `answer: [a, c]` 형태로 작성해요.

검증 규칙 핵심:

- `id`는 카테고리 prefix로 시작해야 해요 (`js-`, `react-`, `css-`, `ts-`, `html-`, `browser-`, `perf-`, `next-` — `lib/categories.ts` 기준)
- choice id·text 중복 금지
- `answer`는 실제 choice id만 참조
- `multi_choice`는 모든 선택지를 정답으로 둘 수 없음

전체 스키마는 `lib/question.schema.ts`가 정의해요. 코드 스니펫 표기(인라인
백틱 vs 펜스 블록), 굵게 강조, `code:` 필드 사용 규칙은 같은 폴더의
[`AGENTS.md`](./AGENTS.md)에 정리돼 있어요. 빌드 타임에 강제되니까 추가/수정
후에는 최소 `pnpm questions:check`를 돌려 주세요.

## 톤 가이드

콘텐츠 톤은 딱딱한 격식체보다 친근한 존댓말이 기본이에요. 특히 `~합니다`
일변도보다 `~해요` 중심으로 따뜻하게 맞춰 주세요.

톤 변환 패턴:

- `~돼` → `~돼요`
- `~야`(명사 뒤) → `~예요` / `~이에요`
- `~지` → `~지요` / `~죠` / `~잖아요`
- `~줘` → `~줘요`
- `~봐` → `~봐요`
- `~한다` → `~해요`
- 명령조 → 권유형 `~해 주세요` / `~하는 게 좋아요`
- 격식체 일변도는 피하고 따뜻하게 유지해 주세요.

제약:

- 의미는 절대 바꾸지 말고 어미만 전환해요.
- Markdown/YAML 들여쓰기는 그대로 보존해요.
- 이모지나 추임새는 추가하지 않아요.
- 짧은 코드성 선택지(타입 표기, 키워드 등)는 건드리지 말고 자연어 설명만 변환해요.

## 검사 자동화

| 명령어 | 용도 |
| --- | --- |
| `pnpm questions:check` | Zod 스키마 + prose/code 래핑 휴리스틱 검사 |
| `pnpm round:check` | 라운드 픽커가 유효한 라운드를 만들 수 있는지 검사 |

위 두 명령은 `prebuild`에 묶여 있어 CI/배포 빌드에서도 강제로 돌아요.

휴리스틱이 잘못 잡는 드문 케이스의 opt-out 마커(`# fmt: off-prose`) 사용법은
[`AGENTS.md`](./AGENTS.md#opt-out)에 정리돼 있어요.

## 라이선스

`content/` 아래 문제·해설·프롬프트는 [CC BY-SA 4.0](./LICENSE)으로 공개돼
있어요. 가져다 쓰실 때는 출처 표기와 동일 라이선스 적용을 부탁드려요.
