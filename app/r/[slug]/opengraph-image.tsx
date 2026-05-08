import { ImageResponse } from "next/og";
import { findResultType } from "@/lib/diagnosis";
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
        if (!r.ok) throw new Error(`Pretendard font fetch failed: ${r.status}`);
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
  const [share, fontData] = await Promise.all([
    getShareById(slug).catch(() => null),
    getFontData(),
  ]);

  const fonts = [{ name: "Pretendard", data: fontData, weight: 700 as const }];

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

  const bucket = findResultType(share.result_type);
  const total = share.question_ids.length;
  const totalCorrect = Math.round((share.score * total) / 100);

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "80px 96px",
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
        <div style={{ display: "flex", fontSize: 200, lineHeight: 1, marginBottom: 24 }}>
          {bucket.emoji}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 16,
            letterSpacing: -2,
          }}
        >
          {share.result_type}
        </div>
        <div style={{ display: "flex", fontSize: 56, color: "#3f3f46" }}>
          {totalCorrect} / {total} · {share.score}%
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 36, color: "#71717a" }}>친구야, 너도 풀어봐 →</div>
    </div>,
    { ...size, fonts, emoji: "twemoji" },
  );
}
