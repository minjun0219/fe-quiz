import { ImageResponse } from "workers-og";
import { logger } from "@/lib/logger.server";
import {
  compactHtml,
  getFontData,
  OG_HEIGHT,
  OG_WIDTH,
  ogOptions,
} from "@/lib/og.server";

/**
 * 홈(`/`)의 공유 카드. 결과 카드(`/r/:slug/og.png`)와 달리 내용이 완전히
 * 고정이라 요청마다 달라질 게 없다 — `ImageResponse`가 붙여주는 immutable
 * `Cache-Control`에 그대로 얹혀 간다.
 *
 * 정적 PNG를 커밋하지 않고 satori로 그리는 이유는 결과 카드와 같은 서체·
 * 팔레트를 한 곳(`lib/og.server.ts`)에서 유지하기 위해서다.
 */
export async function loader() {
  // Pretendard는 서드파티 CDN — fetch가 실패해도(5xx, egress 차단) OG 엔드
  // 포인트가 500 나는 것보단 satori 내장 sans 폴백으로 그리는 게 낫다.
  const fontData = await getFontData().catch((err) => {
    logger.warn({ err }, "[og] Pretendard fetch failed — home card");
    return null;
  });

  // satori는 루트의 `width: 100%`를 캔버스 크기로 풀어주지 않아 콘텐츠 폭으로
  // 줄어들고, `flex: 1` 단축도 해석하지 않는다 — 둘 다 명시값으로 쓴다.
  const html = `
  <div style="display: flex; flex-direction: column; width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px; padding: 72px 96px; background-color: #fafaf9; color: #18181b; font-family: Pretendard;">
    <div style="display: flex; font-size: 32px; color: #f43f5e; letter-spacing: -0.5px;">FE 퀴즈</div>
    <div style="display: flex; flex-direction: column; flex-grow: 1; justify-content: center;">
      <div style="display: flex; font-size: 96px; line-height: 1; margin-bottom: 20px;">🍘</div>
      <div style="display: flex; font-size: 80px; font-weight: 700; line-height: 1.15; letter-spacing: -2px;">누룽지가 내는</div>
      <div style="display: flex; font-size: 80px; font-weight: 700; line-height: 1.15; margin-bottom: 24px; letter-spacing: -2px;">프론트엔드 퀴즈</div>
      <div style="display: flex; font-size: 42px; color: #71717a;">10문제 5분 · 풀면 한마디 보태줌</div>
    </div>
    <div style="display: flex; font-size: 36px; font-weight: 700; color: #f43f5e;">지금 풀어보기 →</div>
  </div>`;

  return new ImageResponse(compactHtml(html), ogOptions(fontData));
}
