import { expect, type Page } from "@playwright/test";

/**
 * 배포된 대상(프리뷰·프로덕션)을 검증 중인가.
 *
 * 프리뷰와 프로덕션은 **같은 D1을 공유한다** — Workers Builds 프리뷰가
 * production 빌드라 프로덕션 바인딩을 쓰기 때문이다(Cloudflare가 Workers의
 * production/non-production 바인딩 분리를 지원하지 않는다). 그래서 쓰기가
 * 들어가는 테스트는 배포 대상에서 돌리면 실제 점수판을 오염시킨다.
 * `writeTest()`가 이 플래그로 알아서 건너뛴다.
 */
export const IS_REMOTE = Boolean(process.env.E2E_BASE_URL);

/**
 * `/api/quiz/feedback`을 가짜 응답으로 바꾼다.
 *
 * 실제 호출은 Anthropic 비용이 붙고 분당 5회 rate limit이 있어서, 재시도가
 * 걸리면 테스트가 스스로 막힌다. 피드백 **내용**이 검증 대상이 아닌 테스트는
 * 전부 이걸 쓰고, 진짜 경로는 `@live` 태그가 붙은 테스트 하나만 탄다.
 */
export async function mockFeedback(page: Page, body = MOCK_FEEDBACK) {
  await page.route("**/api/quiz/feedback", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body,
    }),
  );
}

export const MOCK_FEEDBACK =
  "CSS는 안정적이었네요. 선택자 우선순위를 잘 잡았어요.\n\n다만 이벤트 위임 쪽이 아쉬웠어요.";

/** 라운드 길이. "1 / 10" 헤더에서 읽어 `ROUND_SIZE` 변경에 딸려가게 한다. */
export async function roundSize(page: Page): Promise<number> {
  const header = await page.getByText(/^\d+ \/ \d+$/).innerText();
  return Number(header.split("/")[1].trim());
}

/**
 * 현재 문항이 `n`번이 될 때까지 기다린다.
 *
 * 값을 즉시 읽지 않고 재시도 단언을 쓰는 이유 — 문항 이동도 `goBack()`도
 * 클라이언트 내비게이션이라, 이벤트가 끝나도 React 렌더는 한 박자 뒤다.
 * 바로 읽으면 직전 문항 번호를 잡는다.
 */
export async function expectIndex(page: Page, n: number) {
  await expect(page.getByText(/^\d+ \/ \d+$/)).toHaveText(
    new RegExp(`^${n} / `),
  );
}

/**
 * 한 문항을 답하고 넘어간다. 실제 인풋은 `peer sr-only`라 사용자가 보는
 * `<label>`을 클릭한다.
 *
 * **이동이 끝날 때까지 기다린다.** 문항 전환은 URL 커서를 갈아끼우는
 * 클라이언트 내비게이션이라, 안 기다리면 다음 단언이나 `goBack()`이 아직
 * 일어나지 않은 이동을 앞질러 간다.
 */
export async function answerAndAdvance(page: Page) {
  const before = await page.getByText(/^\d+ \/ \d+$/).innerText();
  await page.locator("li:has(input) label").first().click();
  await page.getByRole("button", { name: /다음|결과 보기/ }).click();

  // 마지막 문항이면 헤더가 사라지고 채점 → 결과로 넘어간다. 둘 중 하나를 기다린다.
  await page.waitForFunction(
    (prev) => {
      const header = [...document.querySelectorAll("main span")].find((el) =>
        /^\d+ \/ \d+$/.test(el.textContent?.trim() ?? ""),
      );
      if (!header) {
        return true;
      }
      return header.textContent?.trim() !== prev;
    },
    before,
    { timeout: 15_000 },
  );
}

/** 라운드를 끝까지 풀어 결과 화면까지 간다. */
export async function playThroughRound(page: Page) {
  const total = await roundSize(page);
  for (let i = 0; i < total; i += 1) {
    await answerAndAdvance(page);
  }
}
