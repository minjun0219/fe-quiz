import { ImageResponse } from "workers-og";
import {
  buildTypeCode,
  computePersonality,
  resolveResultHero,
} from "@/lib/diagnosis";
import { logger } from "@/lib/logger.server";
import {
  compactHtml,
  escapeHtml,
  getFontData,
  OG_HEIGHT,
  OG_WIDTH,
  ogOptions,
} from "@/lib/og.server";
import { getShareById } from "@/lib/share-store.server";
import type { Route } from "./+types/share-og";

export async function loader({ params }: Route.LoaderArgs) {
  // Pretendard는 서드파티 CDN — fetch가 실패해도(5xx, egress 차단) OG 엔드
  // 포인트가 500 나는 것보단 satori 내장 sans 폴백으로 그리는 게 낫다.
  const [share, fontData] = await Promise.all([
    // D1 장애도 "결과 없음" 카드로 폴백한다(소셜 스크레이퍼에 500 대신
    // 렌더 가능한 이미지). 대신 조용히 삼키지 않고 로깅해 관측은 남긴다.
    getShareById(params.slug).catch((err) => {
      logger.error(
        { err, slug: params.slug },
        "[og] getShareById failed — not-found card fallback",
      );
      return null;
    }),
    getFontData().catch((err) => {
      logger.warn({ err }, "[og] Pretendard fetch failed");
      return null;
    }),
  ]);

  const options = ogOptions(fontData);

  if (!share) {
    return new ImageResponse(
      `<div style="display: flex; width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px; align-items: center; justify-content: center; background-color: #fafaf9; color: #71717a; font-family: Pretendard; font-size: 56px;">결과를 찾을 수 없어요 😅</div>`,
      options,
    );
  }

  const hero = resolveResultHero(share.result_type);
  const total = share.question_ids.length;
  const totalCorrect = Math.round((share.score * total) / 100);
  const personality = hero.persona
    ? computePersonality(share.category_scores)
    : null;
  const typeCode =
    hero.persona && personality
      ? buildTypeCode(personality, hero.persona.id)
      : null;

  const chipHtml =
    typeCode && personality
      ? `<div style="display: flex; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; font-size: 36px; font-weight: 700; color: #3f3f46; background-color: #ffffff; border: 2px solid #d4d4d8; border-radius: 9999px; padding: 8px 24px; letter-spacing: 1px;">${escapeHtml(typeCode)}</div>
          <div style="display: flex; font-size: 32px; color: #71717a; margin-left: 16px;">${personality === "balanced" ? "균형형" : "편식형"}</div>
        </div>`
      : "";

  // Korean persona names are short today (max 6 chars), but guard against
  // future longer names by clamping to a single line (nowrap + ellipsis).
  const html = `
  <div style="display: flex; flex-direction: column; width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px; padding: 72px 96px; background-color: #fafaf9; color: #18181b; font-family: Pretendard;">
    <div style="display: flex; font-size: 32px; color: #f43f5e; margin-bottom: 8px; letter-spacing: -0.5px;">FE 퀴즈</div>
    <div style="display: flex; flex-direction: column; flex-grow: 1; justify-content: center;">
      <div style="display: flex; font-size: 160px; line-height: 1; margin-bottom: 16px;">${hero.emoji}</div>
      <div style="display: flex; font-size: 88px; font-weight: 700; line-height: 1.1; margin-bottom: 12px; letter-spacing: -2px; white-space: nowrap; overflow: hidden; width: 100%;">${escapeHtml(hero.name)}</div>
      ${chipHtml}
      <div style="display: flex; font-size: 48px; font-weight: 700; color: #18181b; line-height: 1.2;">${totalCorrect} / ${total} · ${share.score}%</div>
    </div>
    <div style="display: flex; font-size: 36px; color: #71717a;">너도 풀어봐 →</div>
  </div>`;

  return new ImageResponse(compactHtml(html), options);
}
