"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // PostHog 미초기화면(키 없음/dev) 그냥 조용히 넘어감 — Next.js 자체
    // 에러 오버레이가 dev에선 이미 띄워주고, prod에선 보고 채널이 없을 뿐.
    if (posthog.__loaded) {
      posthog.captureException(error);
    }
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-2xl font-bold">앗, 문제가 생겼어요</h1>
      <p className="text-sm opacity-70">
        잠깐 동안 화면이 안 보일 수 있어요. 다시 시도해 볼까요?
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-current px-4 py-2 text-sm font-medium"
      >
        다시 시도
      </button>
    </main>
  );
}
