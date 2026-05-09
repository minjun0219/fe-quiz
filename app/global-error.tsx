"use client";

import NextError from "next/error";
import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * 루트 레이아웃까지 throw된 최후의 fallback.
 * `app/global-error.tsx`는 자체 <html>/<body>를 포함해야 한다 (Next.js 규약).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (posthog.__loaded) {
      posthog.captureException(error);
    }
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
