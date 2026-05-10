"use client";

import NextError from "next/error";
import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * 루트 레이아웃까지 throw된 최후의 fallback.
 * `app/global-error.tsx`는 자체 <html>/<body>를 포함해야 한다 (Next.js 규약).
 *
 * 이 시점엔 `<PostHogProvider>`가 마운트되지 않은 상태라 `posthog`가 init되어
 * 있지 않다 → 여기서 직접 init한 뒤 captureException 해야 누락 안 됨.
 * `posthog.init`은 `__loaded` 체크 없이도 두 번 부르면 두 번째가 no-op.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      return;
    }
    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: "/ingest",
        person_profiles: "identified_only",
        // global-error 경로는 거의 안 타므로 세션 리플레이/페이지뷰는 굳이 안 켬.
        capture_pageview: false,
        autocapture: false,
      });
    }
    posthog.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="flex flex-col items-center justify-center min-h-screen gap-4">
        <NextError statusCode={0} />
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md border border-current px-4 py-2 text-sm font-medium"
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
