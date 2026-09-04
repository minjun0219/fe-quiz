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
import { initPostHog, PostHogProvider } from "@/components/PostHogProvider";
import { resolveSiteUrl } from "@/lib/site-url.server";
import type { Route } from "./+types/root";
import "./app.css";

/**
 * meta()는 클라이언트 내비게이션에서도 실행되므로 env 접근은 loader에서
 * 끝내고 절대 URL을 데이터로 내려보낸다 (share.tsx와 같은 이유). og:image는
 * 상대 경로가 허용되지 않아 절대 URL이 필수고, origin이 env별로 다르다.
 */
export function loader({ request }: Route.LoaderArgs) {
  const siteUrl = resolveSiteUrl(request);
  return {
    siteUrl,
    ogImageUrl: new URL("/og.png", siteUrl).toString(),
  };
}

/**
 * 루트 meta는 자체 meta가 없는 라우트(홈·`/play`)의 카드가 된다. `/r/:slug`는
 * 자기 meta로 통째로 대체하므로 결과 카드와 충돌하지 않는다.
 */
export const meta: Route.MetaFunction = ({ loaderData }) => [
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
  ...(loaderData
    ? [
        { property: "og:url", content: loaderData.siteUrl },
        { property: "og:image", content: loaderData.ogImageUrl },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        {
          property: "og:image:alt",
          content: "누룽지가 내는 프론트엔드 퀴즈 — 10문제 5분",
        },
        { name: "twitter:image", content: loaderData.ogImageUrl },
      ]
    : []),
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "FE 퀴즈" },
  {
    name: "twitter:description",
    content: "누룽지(🍘)가 퀴즈 내고 한마디 보태주는 프론트엔드 미니게임",
  },
];

const FONT_ORIGIN = "https://s.minjun.dev";

// 경로에 버전 세그먼트가 없다 — 오리진 규약이 그렇다. 캐시는 일주일
// (`max-age=604800, stale-while-revalidate=2592000`)이고 갱신되면 같은 URL의
// 내용이 바뀐다. 소비자가 할 일은 없고, 지금 어느 버전이 서빙되는지는
// `/manifest.json`에서 본다.
const PRETENDARD_CSS = `${FONT_ORIGIN}/pretendard/variable/pretendardvariable-dynamic-subset.css`;

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico" },
  // 폰트 파일은 CORS로 받으므로 preconnect에도 crossOrigin이 붙어야 연결이
  // 재사용된다 — 없으면 non-CORS 연결만 미리 열려 헛돈다.
  {
    rel: "preconnect",
    href: FONT_ORIGIN,
    crossOrigin: "anonymous",
  },
  // dynamic-subset: unicode-range로 쪼갠 92조각 중 화면에 실제로 쓰인 글자가
  // 든 것만 받는다. 서브셋 없는 풀 variable(`pretendardvariable.css`)은
  // 첫 화면에서 2.0 MB woff2 하나를 통째로 받는데, 하필 그게 텍스트 렌더를
  // 막는 자리에 걸린다.
  //
  // "어차피 한 번 캐시되면 같지 않냐"는 성립하지 않는다 — 실측(홈 → 3라운드
  // 완주):  풀 2,010 KB 고정  vs  서브셋 362 → 553 → 642 → 695 KB.
  // 조각 증가폭이 +191 → +89 → +53 KB로 꺾여서, 흔한 음절을 다 받고 나면
  // 사실상 멈춘다. 역전되려면 92조각(≈3.2 MB)을 다 받아야 하는데 한글 음절
  // 전체를 볼 일이 없다. 대가는 요청 수(3라운드에 72 vs 2)뿐이다.
  {
    rel: "preload",
    as: "style",
    href: PRETENDARD_CSS,
  },
  {
    rel: "stylesheet",
    href: PRETENDARD_CSS,
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
    if (!import.meta.env.VITE_POSTHOG_KEY) {
      return;
    }
    // entry.client에서 이미 init됐지만, 하이드레이션 자체가 깨진 극단 경로
    // 대비 안전망 — initPostHog는 이미 로드됐으면 no-op.
    initPostHog();
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
