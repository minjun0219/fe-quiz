"use client";

import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";
import { Suspense, useEffect } from "react";

/**
 * 클라이언트 PostHog 프로바이더.
 *
 * - 키 미설정 시 init을 건너뛰어 dev/CI에서 throw 없이 no-op.
 * - `/ingest`로 reverse proxy되므로 ad-blocker에 막히지 않음 (next.config.ts).
 * - 익명 가입 없는 제품이라 identified_only로 설정해 봇/무지성 방문이
 *   사용자 카운트를 부풀리지 않도록 함.
 * - 세션 리플레이: form 입력은 전부 마스킹(`maskAllInputs`), 텍스트는 기본
 *   노출이고 민감한 영역에 `data-ph-mask` 속성을 붙여 opt-in 마스킹. 이 앱은
 *   퀴즈 콘텐츠가 본질적으로 공개 텍스트라 default-mask는 디버깅만 어렵게 함.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      return;
    }
    if (posthog.__loaded) {
      return;
    }

    posthog.init(key, {
      api_host: "/ingest",
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false, // 라우트 변경 직접 감지 (아래 PageviewTracker)
      capture_pageleave: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "[data-ph-mask]",
      },
    });
  }, []);

  return (
    <Provider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </Provider>
  );
}

/**
 * Next.js App Router는 라우트 변경 시 페이지를 unmount하지 않으므로
 * pathname/searchParams 변경을 직접 관찰해 `$pageview`를 캡처한다.
 *
 * `useSearchParams`는 Next.js 권장에 따라 Suspense 경계로 감싼다 —
 * 그렇지 않으면 트리 전체가 CSR 폴백으로 떨어진다.
 */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) {
      return;
    }
    if (!pathname) {
      return;
    }
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
