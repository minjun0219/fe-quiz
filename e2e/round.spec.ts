import { expect, test } from "@playwright/test";
import { answerAndAdvance, expectIndex } from "./helpers";

/**
 * 라운드 진행과 문항 커서. 전부 읽기 전용이라 프로덕션에도 안전하다
 * (`/api/quiz/submit`은 채점만 하고 DB에 쓰지 않는다).
 *
 * 여기 있는 것들은 전부 실제로 깨졌던 회귀다 — 커서가 컴포넌트 state였을 때는
 * 브라우저 뒤로가기가 /play를 벗어나 라운드가 통째로 날아갔고, `← 이전`이
 * 히스토리를 push해서 뒤로가기가 방금 떠난 문항으로 되돌아갔다.
 */
test.describe("라운드 커서", () => {
  test("다음을 누르면 URL 커서가 따라오고, 첫 문항은 q 없는 정규형", async ({
    page,
  }) => {
    await page.goto("/play?level=normal");
    await expect(page).not.toHaveURL(/[?&]q=/);
    await expectIndex(page, 1);

    await answerAndAdvance(page);
    await expect(page).toHaveURL(/[?&]q=1\b/);
    await expectIndex(page, 2);
  });

  test("브라우저 뒤로가기가 라운드를 벗어나지 않고 이전 문항으로 간다", async ({
    page,
  }) => {
    await page.goto("/play?level=normal");
    const first = await page.locator("main legend").innerText();
    await answerAndAdvance(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/play\?/);
    await expectIndex(page, 1);
    // 문제 세트가 갈리지 않아야 한다 — 로더가 재실행되면 새 랜덤 라운드가 뽑힌다.
    await expect(page.locator("main legend")).toHaveText(first);
    // 선택도 남아 있어야 한다.
    await expect(page.locator("main input:checked")).toHaveCount(1);
  });

  test("← 이전 직후의 뒤로가기가 방금 떠난 문항으로 되돌아가지 않는다", async ({
    page,
  }) => {
    await page.goto("/play?level=normal");
    await answerAndAdvance(page);
    await answerAndAdvance(page);
    await expectIndex(page, 3);

    await page.getByRole("button", { name: /이전/ }).click();
    await expectIndex(page, 2);

    // push였다면 여기서 3번으로 "전진"한다. navigate(-1)이라야 1번으로 간다.
    await page.goBack();
    await expectIndex(page, 1);
  });

  test.describe("커서를 직접 조작해도 건너뛸 수 없다", () => {
    for (const q of ["9", "-1", "foo", "0"]) {
      test(`?q=${q} → 첫 문항으로 클램프되고 URL도 정규화`, async ({
        page,
      }) => {
        await page.goto(`/play?level=normal&q=${q}`);
        await expectIndex(page, 1);
        await expect(page).not.toHaveURL(/[?&]q=/);
      });
    }
  });

  test("첫 문항에서는 이전 버튼이 없다", async ({ page }) => {
    await page.goto("/play?level=normal");
    await expect(page.getByRole("button", { name: /이전/ })).toHaveCount(0);
  });
});
