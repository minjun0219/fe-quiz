import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { PostHogProvider } from "@/components/PostHogProvider";
import "./globals.css";

// metadataBase는 빌드타임에 결정되는 정적 값이라 request 헤더에서 못 끌어옴.
// Vercel은 모든 배포(프리뷰/프로덕션)에 VERCEL_URL을 자동으로 채워주므로
// 그것만 쓰면 별도 env 관리 없이 OG/canonical이 항상 그 배포를 가리킨다.
// 로컬 dev에서만 폴백으로 localhost.
const SITE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FE 퀴즈 — 누룽지가 내는 프론트엔드 퀴즈",
    template: "%s | FE 퀴즈",
  },
  description:
    "10문제 5분. 가볍게 풀면 누룽지(🍘)가 한마디 보태주는 프론트엔드 미니퀴즈.",
  openGraph: {
    title: "FE 퀴즈",
    description: "누룽지(🍘)가 퀴즈 내고 한마디 보태주는 프론트엔드 미니게임",
    type: "website",
    locale: "ko_KR",
    siteName: "FE 퀴즈",
  },
  twitter: {
    card: "summary_large_image",
    title: "FE 퀴즈",
    description: "누룽지(🍘)가 퀴즈 내고 한마디 보태주는 프론트엔드 미니게임",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="preload"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-dvh flex flex-col font-sans bg-[--color-bg] text-[--color-fg]">
        <PostHogProvider>{children}</PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
