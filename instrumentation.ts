import type { Instrumentation } from "next";

export function register(): void {
  // no-op: 별도 OTel 초기화 없음. PostHog 클라이언트는 lazy 싱글턴.
}

/**
 * Next.js 16의 onRequestError 훅 — 서버 컴포넌트/라우트 핸들러/서버 액션에서
 * throw된 미처리 예외를 한 곳에서 PostHog로 보낸다.
 *
 * 공식 타입(`Instrumentation.onRequestError`)에 따르면 `request.headers`는
 * 이미 plain 객체(`{ [key]: string | string[] }`)라 Headers 인스턴스가 아님.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  // Edge runtime에는 PostHog Node SDK가 못 들어가므로 nodejs 한정.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  // dynamic import로 Edge 번들에 끌려 들어가지 않게 분리.
  const { getPostHogServer } = await import("@/lib/posthog-server");
  const posthog = getPostHogServer();
  if (!posthog) {
    return;
  }

  const distinctId = extractDistinctIdFromCookie(request.headers.cookie);

  await posthog.captureException(err, distinctId ?? undefined, {
    path: request.path,
    method: request.method,
    route: context.routePath,
    route_type: context.routeType,
    router_kind: context.routerKind,
  });
  // 서버리스에서 invocation이 즉시 종료되면 펜딩 이벤트가 유실됨.
  // captureException은 큐에 적재만 하므로 명시적으로 flush.
  await posthog.flush();
};

/**
 * 브라우저 PostHog가 심는 익명 ID 쿠키(`ph_<key>_posthog`)를 파싱해
 * 서버 에러를 같은 사용자로 묶는다. 실패해도 throw하지 않음 — 익명성
 * 자체는 유실 허용 가능, 에러 보고가 막히는 게 더 손해.
 */
function extractDistinctIdFromCookie(
  cookieHeader: string | string[] | undefined,
): string | null {
  if (!cookieHeader) {
    return null;
  }
  const cookieString = Array.isArray(cookieHeader)
    ? cookieHeader.join("; ")
    : cookieHeader;
  const match = cookieString.match(/ph_[^=;]+_posthog=([^;]+)/);
  if (!match?.[1]) {
    return null;
  }
  try {
    const data = JSON.parse(decodeURIComponent(match[1])) as {
      distinct_id?: unknown;
    };
    return typeof data.distinct_id === "string" ? data.distinct_id : null;
  } catch {
    return null;
  }
}
