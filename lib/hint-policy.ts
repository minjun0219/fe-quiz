import type { Difficulty } from "./question.schema";

/**
 * "지금 힌트가 여기 있다고 알려줄 때인가" 판정.
 *
 * 순수 함수로 두는 건 테스트 때문만이 아니다 — 이 기능에서 유일하게 **틀려도
 * 아무 에러가 안 나는** 로직이다. 너무 빨리 뜨면 참견이 되고 너무 늦게 뜨면
 * 없는 기능이 되는데, 둘 다 조용히 일어난다.
 *
 * 판정은 두 종류의 신호를 섞는다:
 *   - 클라이언트가 보는 **행동** — 선택 번복, 재방문
 *   - 서버만 아는 **성적** — 지금까지 맞힌 비율, 이 카테고리에서 이미 틀린 수
 *
 * 체류 시간은 여기 없다. 서버는 "얼마나 기다렸다 알릴 것인가"만 정해서
 * 내보내고, 실제 카운트다운은 클라이언트가 한다 — 그래야 문항당 요청이
 * 한 번으로 끝난다. 서버가 판정하려면 클라이언트가 보낸 체류 시간을 믿어야
 * 하는데, 그러면 그 값을 바꿔 가며 재요청해 임계값을 이진 탐색할 수 있고
 * 임계값은 곧 "아까 그 카테고리에서 틀렸다"는 뜻이 된다.
 *
 * 숫자는 전부 초기 추측이다. PostHog의 `question_viewed`가 index·재방문
 * 여부와 함께 쌓이고 있으니, 실제 체류 분포를 보고 조정한다.
 */

/** 아무 신호도 없을 때. 10문제 5분 라운드에서 한 문항에 35초면 이미 길다. */
const BASE_MS = 35_000;

/**
 * 이 카테고리에서 이미 틀린 적이 있을 때. 같은 영역에서 또 헤매는 중이라
 * 판단 근거가 가장 뾰족한 경우다.
 */
const STRUGGLING_MS = 20_000;

/** 잘 가고 있는 사람은 방해하지 않는다 — 스스로 풀 확률이 높다. */
const CRUISING_MS = 60_000;

/** 정답률을 신뢰할 만한 최소 표본. 1~2문항으로 "잘한다"를 판정하지 않는다. */
const CRUISING_MIN_ANSWERED = 3;
const CRUISING_ACCURACY = 0.8;

/** 어려운 문항은 원래 오래 걸린다. 체류가 길다고 헤매는 건 아니다. */
const HARD_BONUS_MS = 10_000;

/** 선택을 이만큼 갈아치웠으면 고민 중이라는 뜻. */
const THRASH_CHANGES = 3;
const THRASH_RELIEF_MS = 10_000;

/**
 * 아무리 신호가 겹쳐도 이보다 빨리 뜨지는 않는다. 문항을 읽는 시간조차
 * 안 준 채 캐릭터가 튀어나오면 그건 도움이 아니라 방해다.
 *
 * 클라이언트도 이 값을 쓴다 — 서버에 물어보는 시점이다. 재방문(임계값 0)이
 * 아닌 한 이보다 일찍 뱃지가 뜰 수 없으니, 그 전에 묻는 건 낭비다.
 */
export const MIN_NUDGE_AT_MS = 8_000;

export interface NudgeInput {
  /** 현재 문항에서 선택을 바꾼 횟수. */
  changeCount: number;
  /** 앞서 봤던 문항으로 되돌아온 것인지. */
  isRevisit: boolean;
  difficulty: Difficulty;
  /** 현재 문항을 뺀, 실제로 답한 문항 수. */
  answered: number;
  /** 그중 맞힌 수. */
  correct: number;
  /** 현재 문항과 같은 카테고리에서 이미 틀린 수. */
  categoryWrong: number;
}

/**
 * 이 상황에서 뱃지가 뜨기까지 필요한 체류 시간(ms).
 *
 * 재방문은 0을 돌려준다 — 되돌아왔다는 것 자체가 "혼자서는 안 되겠다"는
 * 신호라 다시 기다리게 할 이유가 없다.
 */
export function nudgeThresholdMs(input: NudgeInput): number {
  if (input.isRevisit) {
    return 0;
  }

  let ms = BASE_MS;

  if (isCruising(input)) {
    ms = CRUISING_MS;
  }

  // 카테고리 신호가 정답률을 이긴다. 전체적으로 잘 가고 있어도 이 영역에서
  // 이미 한 번 틀렸다면, 그게 지금 이 문항에 대해 더 구체적인 정보다.
  if (input.categoryWrong > 0) {
    ms = STRUGGLING_MS;
  }

  if (input.difficulty === "hard") {
    ms += HARD_BONUS_MS;
  }

  if (input.changeCount >= THRASH_CHANGES) {
    ms -= THRASH_RELIEF_MS;
  }

  return Math.max(MIN_NUDGE_AT_MS, ms);
}

function isCruising(input: NudgeInput): boolean {
  return (
    input.answered >= CRUISING_MIN_ANSWERED &&
    input.correct / input.answered >= CRUISING_ACCURACY
  );
}
