import { getPostHogServer } from "@/lib/posthog-server.server";

/**
 * Workers용 경량 구조화 로거 — 구 pino 구현과 동일한 호출 계약을 유지한다:
 *
 *   logger.error("msg")
 *   logger.error({ err, ...ctx }, "msg")
 *   logger.error(err)
 *
 * pino를 버린 이유: pino는 Node stream/worker_threads 전제(특히 pino-pretty
 * transport)라 workerd에서 깨진다. Workers에서 console.* JSON 한 줄 출력은
 * Workers Logs(observability)로 수집되므로 그걸로 충분하다.
 *
 * error/fatal은 pino 시절과 동일하게 PostHog captureException으로도 전달.
 */

type Level = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_VALUES: Record<Level | "silent", number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Number.POSITIVE_INFINITY,
};

const isTest = process.env.NODE_ENV === "test";
// wrangler types는 APP_ENV를 wrangler.jsonc vars의 리터럴 유니온("production" |
// "preview")으로 좁히지만, 로컬 dev에선 .dev.vars가 "development"를 주입하므로
// 런타임 값은 타입보다 넓다 — string으로 되돌려 비교한다.
const appEnv: string | undefined = process.env.APP_ENV;
const isDev =
  appEnv === "development" || process.env.NODE_ENV === "development";

const defaultLevel: keyof typeof LEVEL_VALUES = isTest
  ? "silent"
  : isDev
    ? "debug"
    : "info";

// 사용자가 실수로 대문자/공백/오타 값을 넣어도 throw하지 않도록 allowlist 검증.
const rawEnvLevel = process.env.LOG_LEVEL?.trim().toLowerCase();
const envLevel =
  rawEnvLevel && rawEnvLevel in LEVEL_VALUES
    ? (rawEnvLevel as keyof typeof LEVEL_VALUES)
    : undefined;

const threshold = LEVEL_VALUES[envLevel ?? defaultLevel];

function serializeError(err: Error): Record<string, unknown> {
  return { name: err.name, message: err.message, stack: err.stack };
}

function emit(level: Level, args: unknown[]): void {
  if (LEVEL_VALUES[level] < threshold) {
    return;
  }
  forwardToPostHog(args, LEVEL_VALUES[level]);

  const first = args[0];
  const isError = first instanceof Error;
  const isCtx = !isError && typeof first === "object" && first !== null;
  const msg = (isCtx || isError ? args[1] : args[0]) as string | undefined;

  const entry: Record<string, unknown> = {
    level,
    service: "fe-quiz",
    time: new Date().toISOString(),
    ...(isCtx ? (first as Record<string, unknown>) : {}),
    ...(isError ? { err: first } : {}),
    ...(msg !== undefined ? { msg } : {}),
  };
  if (entry.err instanceof Error) {
    entry.err = serializeError(entry.err);
  }

  const line = JSON.stringify(entry);
  if (LEVEL_VALUES[level] >= 50) {
    console.error(line);
  } else if (LEVEL_VALUES[level] >= 40) {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * 로그 객체를 PostHog로 보낸다. error/fatal만 캡처해서 노이즈를 줄임.
 * throw하면 원래 로그 호출까지 깨지므로 try/catch로 감싼다 — PostHog의
 * 일시 장애가 우리 앱을 망가뜨리면 안 됨.
 */
function forwardToPostHog(args: unknown[], level: number): void {
  if (level < 50) {
    return;
  }
  try {
    const posthog = getPostHogServer();
    if (!posthog) {
      return;
    }

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
    // 로그 forwarding 실패는 silently 무시.
  }
}

type LogFn = (objOrMsg: unknown, msg?: string) => void;

export interface Logger {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
}

function makeLevel(level: Level): LogFn {
  return (objOrMsg: unknown, msg?: string) => {
    emit(level, msg === undefined ? [objOrMsg] : [objOrMsg, msg]);
  };
}

export const logger: Logger = {
  trace: makeLevel("trace"),
  debug: makeLevel("debug"),
  info: makeLevel("info"),
  warn: makeLevel("warn"),
  error: makeLevel("error"),
  fatal: makeLevel("fatal"),
};
