import { PostHog } from "posthog-node";

// warm isolate 동안 클라이언트 재생성 방지용 모듈 스코프 캐시.
// Workers에서 요청 간 전역 I/O 공유가 문제되면(R3:
// "Cannot perform I/O on behalf of a different request") 요청 스코프
// 인스턴스로 전환한다 — 호출부 인터페이스는 그대로 유지.
let cached: PostHog | null = null;

const DEFAULT_HOST = "https://us.i.posthog.com";

/**
 * 서버용 PostHog 클라이언트 (싱글턴).
 *
 * 키(`POSTHOG_KEY`)가 없으면 `null`을 반환하므로 호출 측에서 옵셔널
 * 체이닝(`?.`)으로 호출하면 env 미설정 환경(로컬, CI, preview 초기 단계)에서도
 * throw 없이 no-op.
 */
export function getPostHogServer(): PostHog | null {
  const key = process.env.POSTHOG_KEY;
  if (!key) {
    return null;
  }
  cached ??= new PostHog(key, {
    host: process.env.POSTHOG_HOST ?? DEFAULT_HOST,
    // Workers invocation은 짧게 살다 죽으므로 배칭 의미가 없음. 즉시 전송.
    flushAt: 1,
    flushInterval: 0,
  });
  return cached;
}

/**
 * 브라우저 PostHog가 심는 익명 ID 쿠키(`ph_<key>_posthog`)를 파싱해
 * 서버 에러를 같은 사용자로 묶는다. 실패해도 throw하지 않음 — 익명성
 * 자체는 유실 허용 가능, 에러 보고가 막히는 게 더 손해.
 * (구 instrumentation.ts onRequestError의 이식.)
 */
function extractDistinctIdFromCookie(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) {
    return null;
  }
  const match = cookieHeader.match(/ph_[^=;]+_posthog=([^;]+)/);
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

/**
 * 서버 에러 → PostHog 리포터. worker entry의 최후 catch와 entry.server의
 * `handleError`(loader/action/렌더 에러 경로) 양쪽에서 쓴다.
 * PostHog 미설정이면 no-op.
 */
export function captureServerError(err: unknown, request: Request): void {
  const posthog = getPostHogServer();
  if (!posthog) {
    return;
  }
  const distinctId = extractDistinctIdFromCookie(request.headers.get("cookie"));
  const url = new URL(request.url);
  posthog.captureException(
    err instanceof Error ? err : new Error(String(err)),
    distinctId ?? undefined,
    {
      path: url.pathname,
      method: request.method,
    },
  );
}

/**
 * `ctx.waitUntil()`에 실어 안전하게 부르도록 한 flush 래퍼. 네트워크/PostHog
 * 장애로 `flush()`가 reject되면 unhandled rejection이 뜨므로 조용히 삼킨다.
 */
export async function flushPostHogServer(): Promise<void> {
  const posthog = getPostHogServer();
  if (!posthog) {
    return;
  }
  try {
    await posthog.flush();
  } catch {
    // intentionally silent — observability 장애가 invocation 로그를 더럽히면 안 됨.
  }
}
