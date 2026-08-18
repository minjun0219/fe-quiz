import { createRequestHandler } from "react-router";
import {
  captureServerError,
  flushPostHogServer,
} from "../lib/posthog-server.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

/**
 * PostHog reverse proxy: 브라우저가 `/ingest/*`로 보낸 요청을 PostHog의
 * us-assets/us 호스트로 그대로 흘려보낸다. ad-blocker가 `*.posthog.com`을
 * 막아도 자체 도메인이라 통과 — 세션 리플레이/이벤트 캡처가 끊기지 않음.
 * (구 next.config.ts rewrites의 이식. RR 라우트 매칭 앞에서 분기하는 게
 * body 스트리밍 패스스루가 가장 단순하다.)
 *
 * PostHog Cloud 패턴(`{region}.i.posthog.com` → `{region}-assets.i.posthog.com`)
 * 을 가정. 자체 호스팅이면 두 호스트를 별도 env로 잡거나 이 파일 수정 필요.
 */
function proxyIngest(request: Request, url: URL): Promise<Response> {
  const host = (process.env.POSTHOG_HOST ?? "https://us.i.posthog.com").replace(
    /\/$/,
    "",
  );
  const assetsHost = host.replace(
    /^(https?:\/\/)([a-z]+)\.i\.posthog\.com$/,
    "$1$2-assets.i.posthog.com",
  );
  const path = url.pathname.replace(/^\/ingest/, "") || "/";
  const target = path.startsWith("/static/")
    ? `${assetsHost}${path}${url.search}`
    : `${host}${path}${url.search}`;
  return fetch(new Request(target, request));
}

export default {
  async fetch(request, _env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/ingest" || url.pathname.startsWith("/ingest/")) {
      return proxyIngest(request, url);
    }
    try {
      return await requestHandler(request);
    } catch (err) {
      // RR가 자체 처리 못 한 최후의 예외 — 보고 후 정적 500.
      captureServerError(err, request);
      ctx.waitUntil(flushPostHogServer());
      return new Response("Internal Server Error", { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
