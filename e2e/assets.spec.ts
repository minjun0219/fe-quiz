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

  test("캔버스가 실제로 다 칠해진다 (레이아웃이 캔버스 폭으로 안 펴지는 회귀)", async ({
    page,
  }) => {
    // 시그니처와 IHDR만 보면 부족하다 — satori 루트에 `width: 100%`를 쓰면
    // 캔버스가 아니라 콘텐츠 폭으로 줄어들어 오른쪽이 통째로 비는데, 그래도
    // 1200x630 PNG는 그대로 나온다(실제로 겪은 회귀다).
    //
    // 네 귀퉁이가 **서로 같고 불투명**한지만 본다. 팔레트가 바뀌어도 안 깨지고,
    // 안 칠해진 영역은 알파 0으로 남으므로 그 회귀는 확실히 잡힌다.
    await page.goto("/");
    const corners = await page.evaluate(async () => {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = "/og.png";
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("2d context 없음");
      }
      ctx.drawImage(img, 0, 0);
      const at = (x: number, y: number) =>
        Array.from(ctx.getImageData(x, y, 1, 1).data).join(",");
      return {
        topLeft: at(2, 2),
        topRight: at(img.width - 3, 2),
        bottomLeft: at(2, img.height - 3),
        bottomRight: at(img.width - 3, img.height - 3),
      };
    });

    // 안 칠해진 영역은 "0,0,0,0" — 아래 단언이 정확히 그걸 잡는다.
    expect(corners.topRight).toBe(corners.topLeft);
    expect(corners.bottomLeft).toBe(corners.topLeft);
    expect(corners.bottomRight).toBe(corners.topLeft);
    expect(corners.topLeft.endsWith(",255")).toBe(true);
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
    // `response`만 듣으면 DNS/TLS 실패나 차단은 4xx가 아니라 requestfailed로
    // 와서 놓친다. 둘 다 모은다.
    const problems: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("pretendard") && r.status() >= 400) {
        problems.push(`${r.status()} ${r.url()}`);
      }
    });
    page.on("requestfailed", (r) => {
      if (r.url().includes("pretendard")) {
        problems.push(`${r.failure()?.errorText ?? "failed"} ${r.url()}`);
      }
    });

    await page.goto("/");

    // `document.fonts.check()`는 **매칭되는 FontFace가 하나도 없어도 true**를
    // 준다(폴백으로 렌더 가능하다는 뜻이라). 폰트를 통째로 막고 실측해 확인했다
    // — check=true, fonts.size=0. 그래서 실제 face의 존재와 상태를 본다.
    const faces = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].map((f) => ({
        family: f.family,
        status: f.status,
      }));
    });

    expect(problems).toEqual([]);
    expect(
      faces.some(
        (f) => f.family.includes("Pretendard") && f.status === "loaded",
      ),
    ).toBe(true);
  });
});
