import type { NextConfig } from "next";

/**
 * PostHog reverse proxy: 브라우저가 `/ingest/*`로 보낸 요청을 PostHog의
 * us-assets/us 호스트로 그대로 흘려보낸다. ad-blocker가 `*.posthog.com`을
 * 막아도 자체 도메인이라 통과 — 세션 리플레이/이벤트 캡처가 끊기지 않음.
 *
 * 호스트는 빌드 타임에 `NEXT_PUBLIC_POSTHOG_HOST`에서 파생. PostHog Cloud
 * 패턴(`{region}.i.posthog.com` → `{region}-assets.i.posthog.com`)을 가정.
 * 자체 호스팅이면 두 변수 모두 별도 env로 잡거나 이 파일을 직접 수정 필요.
 */
const POSTHOG_HOST = (
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"
).replace(/\/$/, "");
const POSTHOG_ASSETS_HOST = POSTHOG_HOST.replace(
  /^(https?:\/\/)([a-z]+)\.i\.posthog\.com$/,
  "$1$2-assets.i.posthog.com",
);

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: `${POSTHOG_ASSETS_HOST}/static/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `${POSTHOG_HOST}/:path*`,
      },
    ];
  },
  // PostHog가 trailing slash로 흩어지지 않도록 명시 (rewrite와 만나면 308이 끼임).
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
