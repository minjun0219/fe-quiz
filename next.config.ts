import type { NextConfig } from "next";

/**
 * PostHog reverse proxy: 브라우저가 `/ingest/*`로 보낸 요청을 PostHog의
 * us-assets/us 호스트로 그대로 흘려보낸다. ad-blocker가 `*.posthog.com`을
 * 막아도 자체 도메인이라 통과 — 세션 리플레이/이벤트 캡처가 끊기지 않음.
 *
 * - `/ingest/static/*` → assets (recorder.js, surveys 등 정적 파일)
 * - `/ingest/*` → 이벤트/decide/replay
 * - 마지막 `/ingest/decide` 매칭이 빠지면 `/decide`만 유실되므로 명시.
 */
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
    ];
  },
  // PostHog가 trailing slash로 흩어지지 않도록 명시 (rewrite와 만나면 308이 끼임).
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
