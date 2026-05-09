import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { PostHogProvider } from "@/components/PostHogProvider";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
        <PostHogProvider>{children}</PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
