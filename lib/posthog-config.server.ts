import { resolveSiteUrl } from "./site-url.server";

/** root loader가 클라이언트에 내려주는 PostHog 설정. 값은 런타임 env에서 온다. */
export type ClientPostHogConfig = {
  key: string;
  host: string | null;
  uiHost: string | null;
};

/**
 * 클라이언트에 내려줄 PostHog 설정 (`POSTHOG_KEY` · `POSTHOG_HOST` ·
 * `POSTHOG_UI_HOST`, 이름은 hail-mary D-061). 키는 서버 에러 리포팅과 같은
 * project API key다 — `phc_` 키는 이벤트 수집 전용(write-only)이라 브라우저에
 * 노출해도 된다.
 *
 * 공개 origin(`SITE_URL`)으로 들어온 요청에만 준다. Workers Builds PR 프리뷰
 * (`*.workers.dev`)는 같은 워커의 버전이라 production secret을 그대로 보는데,
 * 그 트래픽이 공용 PostHog 프로젝트(`minjun.dev`)에 섞이지 않게 막는다.
 */
export function clientPostHogConfig(
  request: Request,
): ClientPostHogConfig | null {
  const key = process.env.POSTHOG_KEY;
  if (!key) {
    return null;
  }
  if (new URL(request.url).origin !== resolveSiteUrl(request)) {
    return null;
  }
  return {
    key,
    host: process.env.POSTHOG_HOST || null,
    uiHost: process.env.POSTHOG_UI_HOST || null,
  };
}
