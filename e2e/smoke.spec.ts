import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("home renders heading and CTA", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /5문제만 풀어봐/ })).toBeVisible();

    const cta = page.getByRole("link", { name: /지금 풀어보기/ });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/play");
  });

  test("home → /play loads first question and gates the next button", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /지금 풀어보기/ }).click();

    await expect(page).toHaveURL(/\/play$/);

    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
    await expect(page.getByText(/(js|javascript|react|css)\s*·/i)).toBeVisible();

    const advance = page.getByRole("button", { name: /다음|결과 보기/ });
    await expect(advance).toBeVisible();
    await expect(advance).toBeDisabled();

    // 첫 번째 선택지 선택 → canProceed 가 true 가 되어 버튼이 enabled.
    // 인풋 자체가 `peer sr-only`(시각적으로 hidden)라서 `force: true`가 필요.
    const firstChoice = page.getByRole("radio").or(page.getByRole("checkbox")).first();
    await firstChoice.check({ force: true });
    await expect(advance).toBeEnabled();
  });
});
