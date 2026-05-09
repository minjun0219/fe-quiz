import "server-only";
import pino from "pino";

const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

const defaultLevel = isTest ? "silent" : isDev ? "debug" : "info";

// 사용자가 실수로 대문자/공백 포함 값을 넣어도 pino가 throw하지 않도록 정규화.
const envLevel = process.env.LOG_LEVEL?.trim().toLowerCase();

function buildLogger(): pino.Logger {
  return pino({
    level: envLevel || defaultLevel,
    // dev에서만 사람 친화 출력. prod는 stdout JSON → Vercel logs.
    transport: isDev
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
    base: { service: "fe-quiz" },
  });
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
