import "server-only";
import pino from "pino";
import { getPostHogServer } from "@/lib/posthog-server";

const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

const defaultLevel = isTest ? "silent" : isDev ? "debug" : "info";

// 사용자가 실수로 대문자/공백/오타 값을 넣어도 pino가 throw하지 않도록
// pino 공식 레벨 allowlist로 검증.
const ALLOWED_LEVELS = new Set([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
]);
const rawEnvLevel = process.env.LOG_LEVEL?.trim().toLowerCase();
const envLevel =
  rawEnvLevel && ALLOWED_LEVELS.has(rawEnvLevel) ? rawEnvLevel : undefined;

function buildLogger(): pino.Logger {
  return pino({
    level: envLevel ?? defaultLevel,
    // dev에서만 사람 친화 출력. prod는 stdout JSON → Vercel logs.
    transport: isDev
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
    base: { service: "fe-quiz" },
    // logger.warn/error 호출이 그대로 PostHog로도 전달되게 가로챔. pino는
    // 정상 stdout 경로를 그대로 유지(this.info/error 호출)하고, 우리는
    // 추가로 PostHog.captureException을 호출만 함.
    hooks: {
      logMethod(args, method, level) {
        forwardToPostHog(args, level);
        return method.apply(this, args);
      },
    },
  });
}

/**
 * Pino 로그 객체를 PostHog로 보낸다. error/fatal만 캡처해서
 * 노이즈를 줄임 (info/debug는 일상 로그라 이벤트로 안 올림).
 *
 * `forwardToPostHog`가 throw하면 원래 로그 호출까지 깨지므로 try/catch로
 * 감싼다. PostHog의 일시 장애가 우리 앱을 망가뜨리면 안 됨.
 */
function forwardToPostHog(args: unknown[], level: number): void {
  // pino 기본 레벨: trace=10, debug=20, info=30, warn=40, error=50, fatal=60.
  if (level < 50) {
    return;
  }
  try {
    const posthog = getPostHogServer();
    if (!posthog) {
      return;
    }

    // pino 호출 패턴은 세 가지:
    //   logger.error("msg")
    //   logger.error({ err, ...ctx }, "msg")
    //   logger.error(err)            ← 첫 인자가 Error 인스턴스
    // 마지막 케이스는 isCtx 판정이 true라 ctx.err를 못 찾고 stack을 잃었었음.
    const first = args[0];
    const isError = first instanceof Error;
    const isCtx = !isError && typeof first === "object" && first !== null;
    const ctx = (isCtx ? (first as Record<string, unknown>) : {}) as {
      err?: unknown;
    };
    const message = (isCtx || isError ? args[1] : args[0]) as
      | string
      | undefined;

    const error = isError
      ? first
      : ctx.err instanceof Error
        ? ctx.err
        : new Error(message ?? "log.error without message");
    posthog.captureException(error, undefined, {
      log_level: level >= 60 ? "fatal" : "error",
      log_message: message,
    });
  } catch {
    // 로그 forwarding 실패는 silently 무시 — PostHog 장애가 앱을 깨면 안 됨.
  }
}

// Next.js dev HMR로 이 모듈이 재평가될 때마다 pino-pretty worker가 누적돼
// 메모리 누수 + 출력 꼬임이 생기므로, dev에선 globalThis에 캐싱.
const globalForLogger = globalThis as unknown as {
  __fe_quiz_logger?: pino.Logger;
};

function getDevLogger(): pino.Logger {
  globalForLogger.__fe_quiz_logger ??= buildLogger();
  return globalForLogger.__fe_quiz_logger;
}

export const logger: pino.Logger = isDev ? getDevLogger() : buildLogger();
