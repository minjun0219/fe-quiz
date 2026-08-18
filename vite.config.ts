import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    // tsconfig의 "@/*" paths를 그대로 사용 (Vite 8 내장)
    tsconfigPaths: true,
  },
  server: {
    // playwright BASE_URL(localhost:3000) 계약 유지 — 구 next dev와 동일 포트
    port: 3000,
  },
});
