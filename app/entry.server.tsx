import { waitUntil } from "cloudflare:workers";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { EntryContext, RouterContextProvider } from "react-router";
import { ServerRouter } from "react-router";
import { logger } from "@/lib/logger.server";
import {
  captureServerError,
  flushPostHogServer,
} from "@/lib/posthog-server.server";

export const streamTimeout = 5_000;

/**
 * loader/action/렌더에서 throw된 미처리 예외를 PostHog로 보낸다
 * (구 instrumentation.ts onRequestError의 대체 경로). RR가 abort된 요청도
 * 여기로 흘리므로 그건 노이즈라 건너뛴다.
 */
export function handleError(
  error: unknown,
  { request }: { request: Request },
): void {
  if (request.signal.aborted) {
    return;
  }
  captureServerError(error, request);
  waitUntil(flushPostHogServer());
  logger.error(
    error instanceof Error ? error : { err: error },
    "[entry.server] unhandled error",
  );
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider,
) {
  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  }

  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      signal: AbortSignal.timeout(streamTimeout + 1000),
      onError(error: unknown) {
        responseStatusCode = 500;
        // Log streaming rendering errors from inside the shell. Don't log
        // errors encountered during initial shell rendering since they'll
        // reject and get logged in handleDocumentRequest.
        if (shellRendered) {
          logger.error(
            error instanceof Error ? error : { err: error },
            "[entry.server] streaming render error",
          );
        }
      },
    },
  );
  shellRendered = true;

  // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
  // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
