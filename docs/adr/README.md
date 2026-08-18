# Architecture Decision Records

이 디렉토리는 fe-quiz의 **개별 아키텍처 결정**을 박제한 폴더예요.
한 결정마다 한 파일. 형식은 [MADR 미니](./template.md) — 메타 + 맥락 / 결정 / 결과.

`docs/DECISIONS.md`는 계속 "지금 이 프로젝트가 어떻게 생겼는가"를 빠르게 훑는
**살아있는 개요**로 둬요. ADR은 거기서 잘 안 보이는 **왜 그렇게 정했는지, 어떤
대안을 버렸는지, 되돌리면 뭐가 깨지는지**를 담아요. 두 문서는 자연스럽게
인라인 링크로 이어집니다.

## 색인

| # | 제목 | 상태 |
|---|---|---|
| [0001](./0001-daily-quiz-generation-hybrid.md) | 매일 자동 출제 — 스크립트 + sub-agent 하이브리드 | Accepted |
| [0002](./0002-supabase-server-only-secret-key.md) | Supabase `shares`는 서버 전용 secret 키로만 접근 | Superseded by [0006](./0006-react-router-workers-d1.md) |
| [0003](./0003-vercel-env-environment-split.md) | 환경 분기는 `VERCEL_ENV` 기준 (`NODE_ENV` 금지) | Superseded by [0006](./0006-react-router-workers-d1.md) |
| [0004](./0004-yaml-content-with-zod-validation.md) | 질문 콘텐츠는 YAML + Zod 검증 (마크다운 frontmatter 안 씀) | Accepted |
| [0005](./0005-no-client-answer-exposure.md) | 클라이언트로 정답·해설·출처 안 내려보내기 | Accepted |
| [0006](./0006-react-router-workers-d1.md) | 호스팅·프레임워크·DB를 Cloudflare 스택으로 이전 | Accepted |

## 새 ADR을 언제 쓰나

ADR로 박제할 가치가 있는 결정의 기준:

- **되돌리면 비용이 크다** — 보안 경계, 데이터 모델, 런타임 환경, 자동화 시스템
  골격, 핵심 라이브러리 채택·교체
- **선택한 길 외에 진지하게 검토했던 대안이 있다** — 트레이드오프가 기록되어야
  나중에 다시 흔들리지 않아요
- **"왜 이렇게 했지?"가 6개월 뒤 안 떠오를 것 같다** — 코드만 봐서는 의도가
  복원이 안 되는 결정

이렇지 않은 일(단순 리팩토링, UI 카피, 일회성 픽스, 의존성 패치 업데이트)은
ADR을 안 만들어도 돼요. PR 설명으로 충분해요.

## 새 ADR을 추가하는 절차

1. 마지막 번호 + 1을 4자리 zero-pad로 잡아요. 예: 다음은 `0006`.
2. 파일명: `NNNN-kebab-slug.md`. **날짜는 파일명에 넣지 않아요** — 본문 메타의
   `결정일`에만 박혀요. 슬러그는 결정의 핵심을 짧게.
3. [`template.md`](./template.md)를 복사해 채워요. 한국어 존댓말 톤, 헤더 레벨은
   `#` → `##` 까지.
4. 위 색인 표에 한 줄 추가.
5. `docs/DECISIONS.md`의 매핑되는 항목 옆에 인라인 링크를 달아주세요
   (예: `[ADR 0006](./adr/0006-...md)`).

## 상태 전이

- **Accepted** — 현재 유효한 결정. 기본값.
- **Superseded by [NNNN](./NNNN-...md)** — 더 이상 유효하지 않음. 새 ADR이
  대체. 옛 ADR은 **삭제하지 않아요** — 히스토리 보존이 ADR의 핵심.
- **Deprecated** — 명시적으로 폐기됐지만 대체 ADR이 아직 없음. 짧게만 머무는
  중간 상태.

## AI 초안, 사람 승인

AI agent가 ADR 초안을 작성할 수 있어요. 다만 **최종 승인·머지는 사람**이
책임집니다. 아키텍처에 영향을 주는 변경을 시작하기 전에 관련 ADR을 먼저 훑고,
충돌하는 변경이라면 새 ADR로 명시적으로 supersede하는 흐름으로 가요.
