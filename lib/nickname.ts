/**
 * 점수판에 표시할 닉네임.
 *
 * 인증이 없는 익명 서비스라 "친구끼리 누가 누군지 알아보기"만 되면 되고,
 * 대신 **입력을 요구하지 않는다**. 이름의 출처는 3단계 폴백이다:
 *
 *   1. localStorage에 저장된 이름 — 있으면 무조건 이것. 라운드마다 바뀌면
 *      친구를 특정할 수 없으므로 한 번 정해지면 고정이다.
 *   2. 이번 라운드 피드백(LLM)이 지어준 이름 — 첫 라운드에서 여기서 받는다.
 *   3. 아래 정적 풀에서 추첨 — Anthropic 키가 없거나(503) 형식이 어긋났을 때.
 *      선택적 연동은 fail-open이라는 프로젝트 규칙에 맞춘 안전망이다.
 *
 * 이 모듈은 라우트 컴포넌트가 직접 부르므로 브라우저 안전해야 한다 — 서버
 * 전용 API를 쓰지 않는다.
 */

/** DB·서버 정규화에서 공통으로 쓰는 상한. UI의 maxLength와 같이 움직인다. */
export const NICKNAME_MAX_LENGTH = 16;

/** 닉네임이 없는(=예전) row를 화면에 그릴 때 쓰는 라벨. */
export const ANONYMOUS_LABEL = "익명";

const ADJECTIVES = [
  "느긋한",
  "성실한",
  "조용한",
  "바쁜",
  "솔직한",
  "엉뚱한",
  "꼼꼼한",
  "무심한",
  "재빠른",
  "다정한",
  "고집센",
  "태평한",
  "예리한",
  "덤덤한",
  "낙천적인",
  "수줍은",
] as const;

const ANIMALS = [
  "물범",
  "두더지",
  "다람쥐",
  "오소리",
  "수달",
  "너구리",
  "고슴도치",
  "펭귄",
  "삵",
  "부엉이",
  "왜가리",
  "청설모",
  "여우",
  "돌고래",
  "라쿤",
  "알파카",
] as const;

/**
 * 정적 풀에서 하나 뽑는다. 조합이 256개라 같은 라운드(보통 한 자릿수~수십 명)
 * 안에서 겹칠 일은 드물고, 겹쳐도 점수가 달라 치명적이지 않다 — 완벽한
 * 유일성은 목표가 아니다.
 */
export function randomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

/**
 * 표시·저장 전 정리. 클라이언트가 보내는 값이라 서버에서도 이걸 통과시킨다.
 *
 * 제어문자(줄바꿈·탭 포함)를 지우고 연속 공백을 하나로 접은 뒤 길이를 자른다.
 * 남는 게 없으면 null — "닉네임 없음"과 같은 뜻이다.
 *
 * 사칭은 막지 않는다. 인증이 없으니 남의 이름을 쓰는 걸 기술적으로 구분할
 * 방법이 없고, 친구끼리 돌려보는 규모에서 굳이 방어할 대상도 아니다.
 */
export function normalizeNickname(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const cleaned = raw
    // biome-ignore lint/suspicious/noControlCharactersInRegex: 사용자 입력의 제어문자(줄바꿈 포함)를 공백으로 접는 것이 이 함수의 목적이다.
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NICKNAME_MAX_LENGTH)
    // 상한에서 자르면 마지막 글자가 공백일 수 있다 — 한 번 더 턴다.
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

const STORAGE_KEY = "fe-quiz:nickname";

/**
 * localStorage 접근은 항상 감싼다 — SSR에는 window가 없고, 사파리 프라이빗
 * 모드나 서드파티 쿠키 차단 환경에서는 접근 자체가 throw한다. 이름 하나 때문에
 * 결과 화면이 죽으면 안 된다.
 */
export function readStoredNickname(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return normalizeNickname(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** 저장 실패는 조용히 넘긴다 — 이번 라운드엔 이름이 붙고, 다음에 다시 정해진다. */
export function storeNickname(nickname: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = normalizeNickname(nickname);
  if (!normalized) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // no-op
  }
}
