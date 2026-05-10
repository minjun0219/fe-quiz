import { ImageResponse } from "next/og";
import {
  buildTypeCode,
  computePersonality,
  resolveResultHero,
} from "@/lib/diagnosis";
import { logger } from "@/lib/logger";
import { getShareById } from "@/lib/share-store";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-Bold.woff2";

// Cache the font fetch across requests on the same warm server. On *any*
// failure (non-2xx, network reject, DNS) we null the cache so the next
// request can retry — otherwise a single transient error would pin a
// rejected promise for the lifetime of the process.
let fontPromise: Promise<ArrayBuffer> | null = null;
function getFontData(): Promise<ArrayBuffer> {
  if (!fontPromise) {
    fontPromise = fetch(FONT_URL)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Pretendard font fetch failed: ${r.status}`);
        }
        return r.arrayBuffer();
      })
      .catch((err) => {
        fontPromise = null;
        throw err;
      });
  }
  return fontPromise;
}

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  // Pretendard is hosted on a third-party CDN; if that fetch fails (DNS,
  // 5xx, blocked egress) we still want a renderable image rather than a
  // 500 on the OG endpoint. satori falls back to its built-in sans when
  // `fonts` is omitted.
  const [share, fontData] = await Promise.all([
    getShareById(slug).catch(() => null),
    getFontData().catch((err) => {
      logger.warn({ err }, "[og] Pretendard fetch failed");
      return null;
    }),
  ]);

  const fonts = fontData
    ? [{ name: "Pretendard", data: fontData, weight: 700 as const }]
    : undefined;

  if (!share) {
    return new ImageResponse(
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fafaf9",
          color: "#71717a",
          fontFamily: "Pretendard",
          fontSize: 56,
        }}
      >
        결과를 찾을 수 없어요 😅
      </div>,
      { ...size, fonts, emoji: "twemoji" },
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

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "72px 96px",
        backgroundColor: "#fafaf9",
        color: "#18181b",
        fontFamily: "Pretendard",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 32,
          color: "#f43f5e",
          marginBottom: 8,
          letterSpacing: -0.5,
        }}
      >
        FE 퀴즈
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 160,
            lineHeight: 1,
            marginBottom: 16,
          }}
        >
          {hero.emoji}
        </div>
        <div
          style={{
            // Satori treats text-overflow:ellipsis more reliably with block
            // than with flex; the rest of the hero is left-aligned so we
            // skip textAlign:center and use width:100% to bound the clip.
            display: "block",
            fontSize: 88,
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 12,
            letterSpacing: -2,
            // Korean persona names are short today (max 6 chars), but guard
            // against future longer names by clamping to a single line.
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            width: "100%",
          }}
        >
          {hero.name}
        </div>
        {typeCode && personality && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 36,
                fontWeight: 700,
                color: "#3f3f46",
                backgroundColor: "#ffffff",
                border: "2px solid #d4d4d8",
                borderRadius: 9999,
                padding: "8px 24px",
                letterSpacing: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {typeCode}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 32,
                color: "#71717a",
                marginLeft: 16,
              }}
            >
              {personality === "balanced" ? "균형형" : "편식형"}
            </div>
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontSize: 48,
            // Match the only loaded Pretendard weight (700). Result page uses
            // semibold (600) but adding a second weight just for one line
            // doubles the font payload — visual delta vs. 700 is negligible.
            fontWeight: 700,
            color: "#18181b",
            lineHeight: 1.2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {totalCorrect} / {total} · {share.score}%
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 36, color: "#71717a" }}>
        친구야, 너도 풀어봐 →
      </div>
    </div>,
    { ...size, fonts, emoji: "twemoji" },
  );
}
