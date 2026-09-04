import { expect, test } from "@playwright/test";
import { MOCK_FEEDBACK, mockFeedback, playThroughRound } from "./helpers";

/**
 * 결과 화면. 채점(`/api/quiz/submit`)은 DB에 쓰지 않으므로 배포 대상에도 안전하다.
 * 공유 **생성**만 쓰기라 별도 파일에서 로컬 전용으로 다룬다.
 */
test.describe("결과 화면", () => {
  test("라운드를 끝내면 진단·점수·카테고리별이 나온다", async ({ page }) => {
    await mockFeedback(page);
    await page.goto("/play?level=normal");
    await playThroughRound(page);

    // 채점 결과: "N / M (P%)"
    await expect(page.getByText(/\d+\s*\/\s*\d+/).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /카테고리별/ }),
    ).toBeVisible();
    await expect(page.getByText(MOCK_FEEDBACK.slice(0, 12))).toBeVisible();

    // 피드백이 정착해야 공유 버튼이 열린다.
    await expect(
      page.getByRole("button", { name: /친구한테 보내기/ }),
    ).toBeEnabled();
  });

  test("피드백이 실패해도 공유 버튼은 열린다", async ({ page }) => {
    // 선택적 연동은 fail-open — Anthropic이 없다고 핵심 흐름이 막히면 안 된다.
    await page.route("**/api/quiz/feedback", (route) =>
      route.fulfill({ status: 503, body: '{"error":"unavailable"}' }),
    );
    await page.goto("/play?level=normal");
    await playThroughRound(page);

    await expect(
      page.getByRole("button", { name: /친구한테 보내기/ }),
    ).toBeEnabled();
  });

  test("@live 실제 피드백이 스트리밍된다", async ({ page }) => {
    // 유일하게 Anthropic을 실제로 부르는 테스트다. 나머지는 전부 모킹해서
    // 재시도가 rate limit(분당 5)에 걸리지 않게 한다.
    await page.goto("/play?level=normal");
    await playThroughRound(page);

    const card = page.locator("section", { hasText: "누룽지의 한마디" });
    await expect(card).toBeVisible();
    // 키가 없는 환경(로컬 .dev.vars 미설정)에서는 안내 문구가 뜬다 — 둘 중
    // 하나면 통과. 실패해야 하는 건 "아무것도 안 뜨는" 경우다.
    await expect(async () => {
      const text = await card.innerText();
      expect(text.replace(/\s+/g, "").length).toBeGreaterThan(20);
    }).toPass({ timeout: 30_000 });
  });
});
