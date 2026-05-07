# FE 퀴즈

> 친구처럼 퀴즈 내고 친구처럼 피드백하는 프론트엔드 미니게임

한국어 사용 FE 개발자(특히 면접 준비 중인 주니어/미들) 대상.
단톡방에서 친구가 던지는 퀴즈처럼 가볍게 풀고, 끝에 AI가 친구처럼 피드백 주는 미니게임.
MBTI 검사처럼 결과 공유 바이럴이 핵심.

- 한 라운드 = 5문제 / 3-5분
- 가입 불필요. 결과 공유 시에만 데이터 저장
- 친구 톤. 학습 압박 요소 없음

자세한 컨셉/스택/로드맵은 [`docs/ROADMAP.md`](./docs/ROADMAP.md) 참고.

## 로컬 실행

```bash
nvm use      # .nvmrc 기준 Node 22
npm install
cp .env.local.example .env.local   # 값 채우기 (현재 PR에서는 불필요)
npm run dev
```

→ http://localhost:3000

## 스크립트

| 명령어 | 용도 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드된 앱 실행 |
| `npm run lint` | Biome 린트 |
| `npm run format` | Biome 포맷터 (덮어쓰기) |
| `npm run check` | Biome 린트 + 포맷 검사 (CI용) |

## 라이선스

| 대상 | 라이선스 |
| --- | --- |
| 코드 (저장소 전반) | [MIT](./LICENSE) |
| 콘텐츠 (`content/` 하위 — 문제, 해설, 프롬프트) | [CC BY-SA 4.0](./content/LICENSE) |

문제를 가져다 쓰실 때는 출처 표기와 동일 라이선스 적용을 부탁드려요.

## 기여

지금은 시드 콘텐츠(JS/React/CSS 각 10문제)를 채우는 단계예요.
구조에 변경이 필요한 PR은 먼저 이슈로 논의 부탁드립니다.
