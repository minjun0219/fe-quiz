import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./site-url.server";

describe("resolveSiteUrl", () => {
  const original = process.env.SITE_URL;
  const req = (url: string) => new Request(url);

  beforeEach(() => {
    process.env.SITE_URL = undefined;
  });
  afterEach(() => {
    process.env.SITE_URL = original;
  });

  it("SITE_URL이 있으면 그 origin", () => {
    process.env.SITE_URL = "https://fe-quiz.minjun.dev";
    expect(resolveSiteUrl(req("https://무시.example/r/abc"))).toBe(
      "https://fe-quiz.minjun.dev",
    );
  });

  it("SITE_URL에 경로·트레일링 슬래시가 붙어도 origin만 남긴다", () => {
    process.env.SITE_URL = "https://fe-quiz.minjun.dev/";
    expect(resolveSiteUrl(req("https://x.example/"))).toBe(
      "https://fe-quiz.minjun.dev",
    );
  });

  // 이 셋이 이 모듈의 존재 이유 — 예전에는 전부 "http://localhost:3000"이 나왔고,
  // 프로덕션에서 SITE_URL이 비는 순간 공유 카드에 localhost가 박혔다.
  it("SITE_URL이 없으면 요청 origin을 쓴다 (localhost를 지어내지 않는다)", () => {
    expect(
      resolveSiteUrl(req("https://fe-quiz.minjun.dev/play?level=normal")),
    ).toBe("https://fe-quiz.minjun.dev");
  });

  it("SITE_URL이 빈 문자열이어도 요청 origin", () => {
    process.env.SITE_URL = "";
    expect(
      resolveSiteUrl(req("https://fe-quiz-preview.minjun.workers.dev/")),
    ).toBe("https://fe-quiz-preview.minjun.workers.dev");
  });

  it("SITE_URL이 깨져 있어도 요청 origin으로 폴백한다", () => {
    process.env.SITE_URL = "not a url";
    expect(resolveSiteUrl(req("https://fe-quiz.minjun.dev/"))).toBe(
      "https://fe-quiz.minjun.dev",
    );
  });

  it("로컬에서는 로컬 origin — 포트까지 실제 요청을 따라간다", () => {
    expect(resolveSiteUrl(req("http://localhost:3012/r/abc"))).toBe(
      "http://localhost:3012",
    );
  });
});
