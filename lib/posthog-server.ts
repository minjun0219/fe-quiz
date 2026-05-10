import "server-only";
import { PostHog } from "posthog-node";

// Vercel 서버리스 cold start 사이에 클라이언트가 재생성되지 않도록 globalThis
// 캐시. lib/logger.ts와 동일한 dev HMR 방어 패턴.
const globalForPosthog = globalThis as unknown as { __posthog?: PostHog };

const DEFAULT_HOST = "https://us.i.posthog.com";

/**
 * 서버용 PostHog 클라이언트 (싱글턴).
 *
 * 키가 없으면 `null`을 반환하므로 호출 측에서 옵셔널 체이닝(`?.`)으로 호출하면
 * env 미설정 환경(로컬, CI, preview 초기 단계)에서도 throw 없이 no-op.
 */
export function getPostHogServer(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    return null;
  }
  globalForPosthog.__posthog ??= new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_HOST,
    // 서버리스 함수는 짧게 살다 죽으므로 배칭 의미가 없음. 즉시 전송.
    flushAt: 1,
    flushInterval: 0,
  });
  return globalForPosthog.__posthog;
}

/**
 * `after()` 콜백에서 안전하게 부르도록 한 flush 래퍼. 네트워크/PostHog 장애로
 * `flush()`가 reject되면 unhandled rejection이 떠서 invocation 로그가 더러워짐.
 * 응답 이후 처리이므로 실패는 조용히 삼킨다.
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
