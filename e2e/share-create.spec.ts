import { expect, test } from "@playwright/test";
import { IS_REMOTE, mockFeedback, playThroughRound } from "./helpers";

/**
 * 공유 생성은 **유일한 쓰기 경로**다(`INSERT INTO shares`).
 *
 * 프리뷰와 프로덕션이 같은 D1을 쓰기 때문에 배포 대상에서 돌리면 실제
 * 점수판에 테스트 기록이 남는다 — 같은 문제 세트를 푼 사람의 순위·평균이
 * 그만큼 왜곡된다. 그래서 로컬(로컬 sqlite)에서만 돈다.
 */
test.describe("공유 생성 (로컬 전용)", () => {
  test.skip(
    IS_REMOTE,
    "배포 대상에서는 실행하지 않는다 — 프로덕션 D1에 기록이 남는다",
  );

  test("라운드를 끝내고 공유하면 링크가 나오고 그 페이지가 열린다", async ({
    page,
  }) => {
    await mockFeedback(page);
    await page.goto("/play?level=normal");
    await playThroughRound(page);

    await page.getByRole("button", { name: /친구한테 보내기/ }).click();

    const link = page.getByLabel("공유 링크");
    await expect(link).toBeVisible({ timeout: 20_000 });
    const url = await link.inputValue();
    expect(url).toMatch(/\/r\/[\w-]+$/);

    // 만들어진 링크가 실제로 열려야 한다 — D1 복제 지연으로 잠깐 404가 날 수
    // 있어 store 쪽에 재시도가 있다. 그 경로까지 함께 검증하는 셈.
    await page.goto(new URL(url).pathname);
    await expect(page.getByText(/누룽지의 한마디/)).toBeVisible();
  });
});
