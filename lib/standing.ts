/**
 * 고정 라운드 점수판 — 같은 문제·같은 순서를 푼 사람들 사이에서 내 위치.
 *
 * 라운드를 무엇으로 묶는지는 `share-store.server.ts`의 주석 참고(요약하면
 * `question_ids` JSON 문자열이 곧 라운드 식별자다). 이 모듈은 DB에서 뽑은
 * 집계 숫자만 받아 표시용 값으로 바꾸는 순수 계산이라 단위 테스트가 붙는다
 * — `cloudflare:workers`를 import하는 `.server.ts`는 vitest에서 못 돈다.
 */

/** 점수판 목록 한 줄. */
export interface StandingEntry {
  /** shares row id. 현재 보고 있는 slug와 같으면 이 페이지가 가리키는 기록이다. */
  id: string;
  /** 없으면(예전 row·닉네임 미전송) null → 화면에서 "익명". */
  nickname: string | null;
  score: number;
  /** 1-based 순위. 동점은 같은 값. */
  rank: number;
  /**
   * 이 페이지(URL)가 가리키는 기록. **보고 있는 사람이 아니다** — 공유 링크를
   * 받은 친구에게 "나"로 표시하면 남의 기록을 자기 것으로 읽는다.
   */
  is_me: boolean;
}

/**
 * `getRoundStanding`의 SQL 집계 결과.
 *
 * **세는 단위는 "사람"이 아니라 "기록"이다.** 인증이 없어 같은 사람의 재도전을
 * 구분할 방법이 없다 — 한 명이 같은 라운드를 세 번 풀고 세 번 공유하면 row가
 * 셋 생긴다. 그래서 필드 이름도 화면 문구도 사람 수인 척하지 않는다.
 * (닉네임으로 묶는 방법도 있지만 검증되지 않는 값이라, 없는 신원을 있는 척하는
 * 쪽보다 표현을 사실에 맞추는 쪽을 택했다.)
 */
export interface StandingAggregate {
  /** 이 라운드의 기록 수(= 같은 question_ids를 가진 shares row 수). */
  records: number;
  /** 이 기록보다 점수가 높은 기록 수. */
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
  /** 기록이 이것 하나뿐인 라운드. 비교 대상이 없어 UI가 다른 문구를 쓴다. */
  alone: boolean;
  /** 상위 몇 명 + (내가 그 밖이면) 내 줄. `rankEntries`가 만든다. */
  entries: StandingEntry[];
}

/**
 * 동점 처리는 "나보다 **높은** 점수만 센다" — 같은 점수는 모두 같은 순위가
 * 된다(competition ranking). 70점이 셋이고 그 위에 두 명이면 셋 다 3등이다.
 * 점수판이 익명이라 동점자 사이 순서를 가를 근거(먼저 푼 사람 등)를 굳이
 * 만들지 않았다 — created_at으로 가르면 "같은 점수인데 내가 4등"이 되어
 * 설명할 수 없는 억울함만 생긴다.
 */
export function computeStanding(
  agg: StandingAggregate,
  entries: StandingEntry[] = [],
): Standing {
  const records = Math.max(1, agg.records);
  const rank = agg.better + 1;
  return {
    ...agg,
    records,
    rank,
    top_percent: Math.max(1, Math.round((rank / records) * 100)),
    alone: records <= 1,
    entries,
  };
}

/** `rankEntries`에 넘기는 원본 row — DB에서 점수 내림차순으로 뽑아 온다. */
export interface RawEntry {
  id: string;
  nickname: string | null;
  score: number;
}

/**
 * 점수 내림차순 row에 순위를 매긴다. 동점 규칙은 `computeStanding`과 같아야
 * 한다 — 집계가 말하는 "3등"과 목록에 찍힌 "3등"이 다르면 바로 티가 난다.
 * 그래서 여기서도 "나보다 **높은** 점수 수 + 1"을 쓴다(= 앞선 서로 다른
 * 점수의 개수가 아니라, 앞에 있는 row 중 점수가 더 높은 것의 개수).
 *
 * `myId`가 목록 밖이면 호출부가 내 줄을 따로 붙인다 — 여기서는 받은 것만
 * 매긴다.
 */
export function rankEntries(rows: RawEntry[], myId: string): StandingEntry[] {
  let lastScore: number | null = null;
  let lastRank = 0;
  return rows.map((row, i) => {
    const rank = row.score === lastScore ? lastRank : i + 1;
    lastScore = row.score;
    lastRank = rank;
    return {
      id: row.id,
      nickname: row.nickname,
      score: row.score,
      rank,
      is_me: row.id === myId,
    };
  });
}

/** 점수판 한 줄 요약. 공유 문구로 그대로 쓸 수 있는 형태. */
export function describeStanding(s: Standing): string {
  if (s.alone) {
    return "이 라운드 첫 주자예요";
  }
  return `기록 ${s.records}개 중 ${s.rank}등 · 상위 ${s.top_percent}%`;
}
