import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// env 선택은 빌드 타임 `CLOUDFLARE_ENV` — 기본(미지정)이 production이라
// 별도 가드가 필요 없다. preview 빌드만 `CLOUDFLARE_ENV=preview` 명시
// (wrangler.jsonc 상단 주석 참고).
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
