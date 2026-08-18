import { defineConfig, devices } from "@playwright/test";

const PARSED_PORT = Number.parseInt(process.env.PORT ?? "", 10);
const PORT = Number.isNaN(PARSED_PORT) ? 3000 : PARSED_PORT;
// E2E_BASE_URL이 있으면 로컬 서버를 띄우지 않고 그 배포를 직접 검증한다.
// 예: E2E_BASE_URL=https://fe-quiz-preview.minjun.workers.dev pnpm test:e2e
const REMOTE_URL = process.env.E2E_BASE_URL;
const BASE_URL = REMOTE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: REMOTE_URL
    ? undefined
    : {
        // CI 에서는 prod 빌드와 동일한 번들로 검증 — dev 전용 코드(에러 오버레이 등)가
        // 결과에 끼어드는 걸 방지 (`vite preview`는 빌드된 worker를 workerd로 서빙).
        // 로컬은 빠른 피드백을 위해 dev.
        command: process.env.CI
          ? `pnpm build && pnpm preview --port ${PORT}`
          : "pnpm dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: process.env.CI ? "pipe" : "ignore",
        stderr: "pipe",
      },
});
