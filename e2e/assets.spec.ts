import { expect, test } from "@playwright/test";

/**
 * 공유 카드와 웹폰트. 둘 다 **깨져도 화면이 멀쩡해 보이는** 종류라 사람이
 * 눈치채기 어렵다 — 그래서 e2e로 고정한다.
 *
 * - satori는 레이아웃이 깨져도 200에 이미지를 돌려준다
 * - 폰트는 CORS나 경로가 틀려도 `font-display: swap` 덕에 시스템 폰트로 조용히
 *   폴백한다 (이 프로젝트는 실제로 폰트 오리진을 한 번 옮겼다)
 */
test.describe("공유 카드", () => {
  test("/og.png가 1200x630 PNG로 나온다", async ({ request }) => {
    const res = await request.get("/og.png");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");

    const body = await res.body();
    // PNG 시그니처 + IHDR의 width/height (빅엔디안 4바이트씩).
    expect(body.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(body.readUInt32BE(16)).toBe(1200);
    expect(body.readUInt32BE(20)).toBe(630);
  });

  test("홈 meta의 og:image가 절대 URL이고 실제로 받아진다", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const ogImage = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");

    expect(ogImage).toBeTruthy();
    // 상대 경로는 크롤러가 못 가져온다. localhost가 박히면 배포에서 죽는다.
    expect(ogImage).toMatch(/^https?:\/\//);
    if (process.env.E2E_BASE_URL) {
      expect(ogImage).not.toContain("localhost");
    }
    expect((await request.get(ogImage as string)).status()).toBe(200);
  });
});

test.describe("웹폰트", () => {
  test("Pretendard가 폴백이 아니라 실제로 적용된다", async ({ page }) => {
    const failed: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("pretendard") && r.status() >= 400) {
        failed.push(`${r.status()} ${r.url()}`);
      }
    });

    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    expect(failed).toEqual([]);
    // CORS나 경로가 틀리면 여기서 false — 화면은 시스템 폰트로 멀쩡해 보인다.
    expect(
      await page.evaluate(() =>
        document.fonts.check('16px "Pretendard Variable"'),
      ),
    ).toBe(true);
  });
});
