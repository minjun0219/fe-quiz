import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  redis ??= Redis.fromEnv();
  return redis;
}

// 같은 (prefix, tokens, windowSec) 조합이면 limiter 인스턴스 재사용. 모듈
// scope 캐시라 warm 인스턴스 생애 동안 한 번만 만들어짐.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(prefix: string, tokens: number, windowSec: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const key = `${prefix}:${tokens}:${windowSec}`;
  const cached = limiterCache.get(key);
  if (cached) return cached;
  // prefix에 tokens/window까지 포함시켜 Redis에 박는다. 같은 logical
  // prefix(예: "share")라도 토큰/윈도우를 바꾸면 키가 달라져 옛날 카운터를
  // 그대로 이어받지 않음. 튜닝 시 의도치 않은 잔여 상태 충돌 방지.
  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(tokens, `${windowSec} s`),
    prefix: key,
    analytics: false,
  });
  limiterCache.set(key, limiter);
  return limiter;
}

interface RateLimitOptions {
  /** Redis 키 prefix — 라우트별로 다르게(예: "share", "feedback"). */
  prefix: string;
  /** 윈도우 안에서 허용할 요청 수. */
  tokens: number;
  /** 윈도우 길이(초). */
  windowSec: number;
}

/**
 * IP 기반 rate limit. fail-open:
 *
 * - Upstash env 미설정 → 통과 (로컬 dev / Upstash 연결 전 환경)
 * - limiter 호출 자체 실패 → 통과 + console.warn (Upstash 장애 시 우리 사이트가
 *   같이 죽지 않게)
 *
 * 보안용 가드가 아니라 비용/스팸 보호용이라 가용성을 우선시. 진짜 보안 통제는
 * 서버 검증(zod, RLS 등)이 담당.
 *
 * 호출 패턴:
 *   const limited = await checkRateLimit(req, { prefix: "share", tokens: 10, windowSec: 60 });
 *   if (limited) return limited;
 */
export async function checkRateLimit(
  req: Request,
  opts: RateLimitOptions,
): Promise<Response | null> {
  const limiter = getLimiter(opts.prefix, opts.tokens, opts.windowSec);
  if (!limiter) return null;
  const ip = clientIp(req) ?? "unknown";
  try {
    const { success, reset } = await limiter.limit(ip);
    if (success) return null;
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return new Response(JSON.stringify({ error: "rate limit exceeded", retry_after: retryAfter }), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfter),
      },
    });
  } catch (err) {
    console.warn("[rate-limit] limiter check failed, failing open:", err);
    return null;
  }
}

function clientIp(req: Request): string | null {
  // Vercel은 x-forwarded-for 첫 항목이 클라이언트 원본 IP. 다중 프록시 환경에선
  // 첫 항목이 가장 멀리 있는 클라이언트가 됨.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
