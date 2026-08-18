import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// 순수 로직 (grading / diagnosis / round 등) 단위 테스트용. DOM/JSX 테스트가
// 들어오면 environment를 'jsdom'으로 갈아끼우거나 별도 config 분리.
// `cloudflare:workers`를 import하는 모듈(share-store 등)은 여기서 실행 불가 —
// 순수 로직을 별도 모듈로 분리해서 테스트한다.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./"),
    },
  },
});
