import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// 배포 env는 빌드 타임에 CLOUDFLARE_ENV로 구워진다 (wrangler.jsonc 상단 주석).
// CI(Workers Builds 포함)에서 이 변수 없이 빌드하면 dev 설정(SITE_URL=localhost,
// preview D1)이 그대로 배포되는 사고가 난다 — 실제로 발생했던 사고라(2026-08-19,
// Workers Builds 빌드 커맨드 누락) 조용히 넘어가지 않고 여기서 실패시킨다.
//
// vite config는 `react-router typegen`(typecheck 경로)도 로드하므로 process.argv로
// 실제 `build` 명령일 때만 가드한다 — 안 그러면 CI typecheck까지 같이 죽는다.
const isBuildCommand = process.argv.includes("build");
if (process.env.CI && isBuildCommand && !process.env.CLOUDFLARE_ENV) {
  throw new Error(
    "CI 빌드에 CLOUDFLARE_ENV가 없습니다. 배포 빌드는 반드시 " +
      "`CLOUDFLARE_ENV=production`(또는 preview)을 명시하세요 — " +
      "없으면 로컬 dev 설정이 구워져 배포됩니다.",
  );
}

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
