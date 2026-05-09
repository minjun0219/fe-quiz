import "server-only";
import pino from "pino";

const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

const defaultLevel = isTest ? "silent" : isDev ? "debug" : "info";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? defaultLevel,
  // dev에서만 사람 친화 출력. prod는 stdout JSON → Vercel logs.
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  base: { service: "fe-quiz" },
});
