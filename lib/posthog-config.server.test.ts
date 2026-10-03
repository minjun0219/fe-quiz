import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deriveUiHost } from "./posthog-config";
import { clientPostHogConfig } from "./posthog-config.server";

const NAMES = [
  "POSTHOG_KEY",
  "POSTHOG_HOST",
  "POSTHOG_UI_HOST",
  "SITE_URL",
] as const;

describe("clientPostHogConfig", () => {
  const original = Object.fromEntries(NAMES.map((n) => [n, process.env[n]]));
  const req = (url: string) => new Request(url);

  beforeEach(() => {
    process.env.POSTHOG_KEY = "phc_test";
    process.env.POSTHOG_HOST = "https://z.minjun.kim";
    delete process.env.POSTHOG_UI_HOST;
    process.env.SITE_URL = "https://fe-quiz.minjun.dev";
  });
  afterEach(() => {
    // `process.env.X = undefined`는 문자열 "undefined"가 되므로 지울 땐 delete.
    for (const n of NAMES) {
      if (original[n] === undefined) {
        delete process.env[n];
      } else {
        process.env[n] = original[n];
      }
    }
  });

  it("공개 origin으로 들어온 요청엔 설정을 준다", () => {
    expect(clientPostHogConfig(req("https://fe-quiz.minjun.dev/play"))).toEqual(
      { key: "phc_test", host: "https://z.minjun.kim", uiHost: null },
    );
  });

  it("PR 프리뷰(workers.dev) 요청엔 주지 않는다", () => {
    expect(
      clientPostHogConfig(req("https://b75b2e3c-fe-quiz.minjun.workers.dev/")),
    ).toBeNull();
  });

  it("키가 없으면 null", () => {
    delete process.env.POSTHOG_KEY;
    expect(clientPostHogConfig(req("https://fe-quiz.minjun.dev/"))).toBeNull();
  });

  it("SITE_URL이 없으면(로컬) 요청 origin이 곧 공개 origin", () => {
    delete process.env.SITE_URL;
    expect(clientPostHogConfig(req("http://localhost:5173/"))?.key).toBe(
      "phc_test",
    );
  });
});

describe("deriveUiHost", () => {
  it("PostHog Cloud ingest 호스트면 리전 UI 호스트로", () => {
    expect(deriveUiHost("https://eu.i.posthog.com")).toBe(
      "https://eu.posthog.com",
    );
  });

  it("리버스 프록시나 미설정이면 us로 폴백", () => {
    expect(deriveUiHost("https://z.minjun.kim")).toBe("https://us.posthog.com");
    expect(deriveUiHost(null)).toBe("https://us.posthog.com");
  });
});
