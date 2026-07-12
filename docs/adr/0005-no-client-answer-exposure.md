# 0005. 클라이언트로 정답·해설·출처 안 내려보내기

- 상태: Accepted
- 결정일: 초기 (프로젝트 시작 시)
- 관련: `lib/question.schema.ts` (`PublicQuestion`), `lib/round.ts` (`publicView`), `app/api/quiz/submit/`, [docs/DECISIONS.md](../DECISIONS.md)

## 맥락

퀴즈 컨셉의 절반은 "정답을 안 보고 풀어보는 5분"이에요. 클라이언트 번들에 정답
이 직렬화돼서 들어가면:

- **컨셉 파괴**: DevTools에서 네트워크 응답이나 React 트리를 열면 정답이 그대로
  보임. "단톡방에서 슬쩍 던지는 퀴즈"가 안 됨.
- **공정성 파괴**: 같은 라운드 공유 바이럴 플로우(`/play?from={slug}`)에서 친구
  점수와 비교할 의미가 사라짐.
- **출처 노출**: `references[]`의 MDN/spec 링크가 토픽 힌트로 작동 — 정답을
  몰라도 어디를 보면 되는지 알게 됨.

## 결정

브라우저로 내려가는 **모든** 질문 데이터는 `PublicQuestion` 타입으로 좁힙니다.
`Question`에서 다음 필드를 의도적으로 제거:

```ts
export type PublicQuestion = Omit<
  Question,
  "answer" | "explanation" | "choices" | "references"
> & {
  choices: PublicChoice[];
  question_html?: string;
  code_html?: string;
};
```

(`PublicChoice = Choice & { text_html?: string }` — `id`·`text`는 그대로 유지,
서버 렌더링된 `text_html`만 추가. **`id`는 반드시 남아야** 채점 라우트가
사용자가 어떤 선택지를 골랐는지 식별할 수 있어요.)

- 변환은 `lib/round.ts`의 `publicView()` 한 곳에서만 수행. 채점은 서버
  사이드(`POST /api/quiz/submit`)에서 원본 `Question`을 들고 수행.
- `PublicQuestion` 타입은 `lib/question.schema.ts`에 살아요 — 클라이언트
  컴포넌트가 `import type`으로 가져갈 때 `server-only` 모듈 경계를 안 건드림.
- 같은 라운드 재플레이(`pickRoundQuestionsByIds`)도 동일하게 `publicView`를
  거쳐요.

## 결과

- 클라이언트 번들·네트워크 응답 어디에도 정답이 직렬화되지 않음.
- 채점은 서버에서 1차, 공유 생성 시 서버에서 재채점하는 2차로 일관성 보장.
- **포기한 것**: 클라이언트에서 즉시 채점해 RT를 줄이는 패턴 불가. 채점은 항상
  서버 라운드트립.
- **함정**: 새 API 라우트나 RSC props로 질문 데이터를 내려보낼 때 **반드시**
  `publicView()`를 거치거나 `PublicQuestion` 타입으로 좁혀야 해요. `Question`을
  그대로 직렬화하는 코드가 한 군데라도 새로 생기면 보안 + 컨셉이 함께 깨져요.
  TypeScript 타입이 가드 역할을 하지만, `as any`·`JSON.stringify(q)` 같은 우회는
  레이더에 안 잡히니 리뷰에서 같이 봐주세요.
- **함정**: 인덱스/카탈로그 문서(`content/INDEX.md`)에도 정답·해설·출처·choices를
  넣지 않아요. 인덱스가 다른 모델의 컨텍스트로 흘러 들어가도 정답 누수가 없게.
