import posthog from "posthog-js";
import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import {
  POSTHOG_API_HOST,
  POSTHOG_UI_HOST,
  PostHogProvider,
} from "@/components/PostHogProvider";
import type { Route } from "./+types/root";
import "./app.css";

export const meta: Route.MetaFunction = () => [
  { title: "FE 퀴즈 — 누룽지가 내는 프론트엔드 퀴즈" },
  {
    name: "description",
    content:
      "10문제 5분. 가볍게 풀면 누룽지(🍘)가 한마디 보태주는 프론트엔드 미니퀴즈.",
  },
  { property: "og:title", content: "FE 퀴즈" },
  {
    property: "og:description",
    content: "누룽지(🍘)가 퀴즈 내고 한마디 보태주는 프론트엔드 미니게임",
  },
  { property: "og:type", content: "website" },
  { property: "og:locale", content: "ko_KR" },
  { property: "og:site_name", content: "FE 퀴즈" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "FE 퀴즈" },
  {
    name: "twitter:description",
    content: "누룽지(🍘)가 퀴즈 내고 한마디 보태주는 프론트엔드 미니게임",
  },
];

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico" },
  {
    rel: "preconnect",
    href: "https://cdn.jsdelivr.net",
    crossOrigin: "anonymous",
  },
  {
    rel: "preload",
    as: "style",
    href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css",
  },
  {
    rel: "stylesheet",
    href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#fafaf9"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#09090b"
        />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh flex flex-col font-sans bg-[--color-bg] text-[--color-fg]">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <PostHogProvider>
      <Outlet />
    </PostHogProvider>
  );
}

/**
 * 루트 에러 바운더리 — 구 Next의 not-found.tsx(404) + error.tsx +
 * global-error.tsx를 하나로 통합. RR는 loader의 `throw new Response(404)`와
 * 렌더 에러가 모두 여기로 온다.
 *
 * 이 시점엔 `<PostHogProvider>`가 마운트되지 않았을 수 있어 posthog가 init
 * 안 됐으면 직접 init 후 captureException — 두 번 불러도 두 번째는 no-op.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    if (isNotFound) {
      return;
    }
    const key = import.meta.env.VITE_POSTHOG_KEY;
    if (!key) {
      return;
    }
    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: POSTHOG_API_HOST,
        ui_host: POSTHOG_UI_HOST,
        person_profiles: "identified_only",
        // 에러 경로는 거의 안 타므로 세션 리플레이/페이지뷰는 굳이 안 켬.
        capture_pageview: false,
        autocapture: false,
      });
    }
    posthog.captureException(
      error instanceof Error ? error : new Error(String(error)),
    );
  }, [error, isNotFound]);

  if (isNotFound) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <p className="text-sm font-medium tracking-wide text-rose-500">
          🍘 누룽지가 못 찾았어요
        </p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          이 페이지는 사라졌거나 없어요
        </h1>
        <p className="max-w-md text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
          공유 링크가 만료되었거나 주소를 잘못 입력했을 수 있어요. 메인으로
          돌아가서 새 라운드 풀어볼까요?
        </p>
        <Link
          to="/"
          className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          홈으로 가기 →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-2xl font-bold">앗, 문제가 생겼어요</h1>
      <p className="text-sm opacity-70">
        잠깐 동안 화면이 안 보일 수 있어요. 다시 시도해 볼까요?
      </p>
      <div className="mt-2 flex flex-col items-stretch gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border border-current px-4 py-2 text-sm font-medium"
        >
          다시 시도
        </button>
        <Link
          to="/"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          홈으로 가기
        </Link>
      </div>
    </main>
  );
}
