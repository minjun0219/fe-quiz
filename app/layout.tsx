import type { Metadata, Viewport } from "next";
import "./globals.css";

// metadataBase는 빌드타임에 결정되는 정적 값이라 request 헤더에서 못 끌어옴.
// 우선순위:
//  1) NEXT_PUBLIC_SITE_URL (명시 override)
//  2) Vercel 프리뷰 배포라면 VERCEL_URL (deployment-specific) → OG/canonical이
//     그 프리뷰 자체를 가리키게 해서 메타 카드 테스트가 정확해진다.
//     주의: 프로덕션에선 VERCEL_URL도 *.vercel.app으로 채워지므로 의도한
//     커스텀 도메인이 안 잡힘 → VERCEL_ENV로 preview일 때만 적용.
//  3) 운영 커스텀 도메인 하드코딩 폴백.
// 로컬 dev에선 NEXT_PUBLIC_SITE_URL=http://localhost:3000을 .env.local에
// 두면 override 가능.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://fe-quiz.minjun.dev");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FE 퀴즈 — 친구가 내는 프론트엔드 퀴즈",
    template: "%s | FE 퀴즈",
  },
  description:
    "10문제 5분. 친구처럼 가볍게 풀고, AI가 친구처럼 피드백 주는 한국어 프론트엔드 미니퀴즈.",
  openGraph: {
    title: "FE 퀴즈",
    description: "친구처럼 퀴즈 내고 친구처럼 피드백하는 프론트엔드 미니게임",
    type: "website",
    locale: "ko_KR",
    siteName: "FE 퀴즈",
  },
  twitter: {
    card: "summary_large_image",
    title: "FE 퀴즈",
    description: "친구처럼 퀴즈 내고 친구처럼 피드백하는 프론트엔드 미니게임",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-dvh flex flex-col font-sans bg-[--color-bg] text-[--color-fg]">
        {children}
      </body>
    </html>
  );
}
