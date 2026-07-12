import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("home renders heading and level CTAs", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /10문제만 풀어봐/ }),
    ).toBeVisible();

    // 홈의 CTA는 난이도 선택 링크들. 기본(보통)은 `/play?level=normal` 로 이동.
    const cta = page.getByRole("link", { name: /보통/ });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/play?level=normal");
  });

  test("home → /play loads first question and gates the next button", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /보통/ }).click();

    await expect(page).toHaveURL(/\/play\?level=normal/);

    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
    // 헤더는 `<category> · <difficulty>` 형식. 첫 문제 카테고리는 라운드 풀에서
    // 뽑히므로(어떤 등록 카테고리든 가능) 특정 카테고리로 단정하지 않고, 난이도
    // 표기가 붙는 형식만 검증해 플래키함을 피한다.
    await expect(page.getByText(/·\s*(easy|medium|hard)\b/)).toBeVisible();

    const advance = page.getByRole("button", { name: /다음|결과 보기/ });
    await expect(advance).toBeVisible();
    await expect(advance).toBeDisabled();

    // 첫 번째 선택지 선택 → canProceed 가 true 가 되어 버튼이 enabled.
    // 실제 인풋은 `peer sr-only`(시각적으로 hidden)라 사용자처럼 보이는 `<label>`을
    // 클릭한다. 검증은 인풋의 checked 대신 우리가 실제로 확인하려는 버튼 활성화로.
    await page.locator("li:has(input) label").first().click();
    await expect(advance).toBeEnabled();
  });
});
