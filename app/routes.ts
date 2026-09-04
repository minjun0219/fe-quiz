import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("play", "routes/play.tsx"),
  // 홈 공유 카드. 결과 카드(`r/:slug/og.png`)와 짝을 이루는 "입구" 이미지로,
  // root.tsx의 meta가 og:image로 이 경로의 절대 URL을 가리킨다.
  route("og.png", "routes/home-og.ts"),
  route("r/:slug", "routes/share.tsx"),
  // OG 이미지는 Next의 파일 규약(opengraph-image) 대신 명시 라우트.
  // share.tsx의 meta가 og:image로 이 경로의 절대 URL을 지정한다.
  route("r/:slug/og.png", "routes/share-og.ts"),
  // API URL은 구 Next 시절 계약 그대로 — 클라이언트 fetch가 하드코딩돼 있다.
  route("api/quiz/submit", "routes/api.quiz-submit.ts"),
  route("api/quiz/feedback", "routes/api.quiz-feedback.ts"),
  route("api/share", "routes/api.share.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
] satisfies RouteConfig;
