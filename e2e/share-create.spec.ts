import { expect, test } from "@playwright/test";
import { E2E_MARKER, mockFeedback, playThroughRound } from "./helpers";

/**
 * 공유 생성은 **유일한 쓰기 경로**다(`INSERT INTO shares`). 그리고 이번
 * 프로젝트에서 가장 크게 터진 사고가 정확히 여기였다 — 프로덕션 D1에 없는
 * 컬럼을 INSERT해서 배포에서만 500이 났고, 로컬에서는 끝까지 초록이었다.
 * 그래서 배포 대상에서도 돌린다.
 *
 * 대신 만든 row는 남기지 않는다. 저장되는 `feedback` 앞에 마커를 박고, CI가
 * 잡 끝에 D1 API로 지운다(`e2e.yml`의 "e2e가 남긴 row 정리"). 로컬은 로컬
 * sqlite라 정리할 것이 없다.
 */
test.describe("공유 생성", () => {
  test("라운드를 끝내고 공유하면 링크가 나오고 그 페이지가 열린다", async ({
    page,
  }) => {
    // 이 텍스트가 그대로 shares.feedback에 저장된다 — 정리는 이걸 보고 한다.
    await mockFeedback(page, `${E2E_MARKER} e2e가 만든 결과입니다.`);
    await page.goto("/play?level=normal");
    await playThroughRound(page);

    await page.getByRole("button", { name: /친구한테 보내기/ }).click();

    const link = page.getByLabel("공유 링크");
    await expect(link).toBeVisible({ timeout: 20_000 });
    const url = await link.inputValue();
    expect(url).toMatch(/\/r\/[\w-]+$/);

    // 만들어진 링크가 실제로 열려야 한다 — D1은 write 직후 다른 콜로에서 read가
    // 잠깐 안 보일 수 있어 store에 재시도가 있다. 그 경로까지 함께 검증하는 셈.
    await page.goto(new URL(url).pathname);
    await expect(page.getByText(E2E_MARKER, { exact: false })).toBeVisible();
  });
});
