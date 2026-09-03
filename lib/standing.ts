/**
 * 고정 라운드 점수판 — 같은 문제·같은 순서를 푼 사람들 사이에서 내 위치.
 *
 * 라운드를 무엇으로 묶는지는 `share-store.server.ts`의 주석 참고(요약하면
 * `question_ids` JSON 문자열이 곧 라운드 식별자다). 이 모듈은 DB에서 뽑은
 * 집계 숫자만 받아 표시용 값으로 바꾸는 순수 계산이라 단위 테스트가 붙는다
 * — `cloudflare:workers`를 import하는 `.server.ts`는 vitest에서 못 돈다.
 */

/** `getRoundStanding`의 SQL 집계 결과. */
export interface StandingAggregate {
  /** 이 라운드를 푼 총 인원(= 같은 question_ids를 가진 shares row 수). */
  players: number;
  /** 나보다 점수가 높은 인원. */
  better: number;
  /** 참가자 평균 점수(0..100). */
  average: number;
  /** 이 라운드 최고 점수(0..100). */
  best: number;
}

export interface Standing extends StandingAggregate {
  /** 1-based 순위. 동점자는 같은 순위를 가진다(공동 3등 다음은 5등이 아니라 그대로 표기하지 않는다 — 아래 주석 참고). */
  rank: number;
  /** "상위 N%". 1보다 작아지지 않게 바닥을 둔다 — 1등이 "상위 0%"가 되면 읽기 이상하다. */
  top_percent: number;
  /** 참가자가 나 혼자인 라운드. 순위를 말할 대상이 없어 UI가 다른 문구를 쓴다. */
  alone: boolean;
}

/**
 * 동점 처리는 "나보다 **높은** 점수만 센다" — 같은 점수는 모두 같은 순위가
 * 된다(competition ranking). 70점이 셋이고 그 위에 두 명이면 셋 다 3등이다.
 * 점수판이 익명이라 동점자 사이 순서를 가를 근거(먼저 푼 사람 등)를 굳이
 * 만들지 않았다 — created_at으로 가르면 "같은 점수인데 내가 4등"이 되어
 * 설명할 수 없는 억울함만 생긴다.
 */
export function computeStanding(agg: StandingAggregate): Standing {
  const players = Math.max(1, agg.players);
  const rank = agg.better + 1;
  return {
    ...agg,
    players,
    rank,
    top_percent: Math.max(1, Math.round((rank / players) * 100)),
    alone: players <= 1,
  };
}

/** 점수판 한 줄 요약. 공유 문구로 그대로 쓸 수 있는 형태. */
export function describeStanding(s: Standing): string {
  if (s.alone) {
    return "이 라운드 첫 주자예요";
  }
  return `${s.players}명 중 ${s.rank}등 · 상위 ${s.top_percent}%`;
}
