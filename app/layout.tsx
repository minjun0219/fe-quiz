import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FE 퀴즈 — 친구가 내는 프론트엔드 퀴즈",
    template: "%s | FE 퀴즈",
  },
  description:
    "5문제 3분. 친구처럼 가볍게 풀고, AI가 친구처럼 피드백 주는 한국어 프론트엔드 미니퀴즈.",
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
  viewportFit: "cover",
  themeColor: "#fafaf9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
        {children}
      </body>
    </html>
  );
}
