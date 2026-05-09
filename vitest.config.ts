import path from "node:path";
import { defineConfig } from "vitest/config";

// 순수 로직 (grading / diagnosis / round 등) 단위 테스트용. DOM/JSX 테스트가
// 들어오면 environment를 'jsdom'으로 갈아끼우거나 별도 config 분리.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // server-only 가드는 Next bundler가 책임지므로 Vitest에선 no-op shim.
      "server-only": path.resolve(__dirname, "./test/server-only.ts"),
    },
  },
});
