import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { initPostHog } from "@/components/PostHogProvider";

// 하이드레이션 전에 PostHog init — effect 순서 문제로 첫 $pageview·초기
// track() 큐가 드롭되지 않게 (components/PostHogProvider.tsx 주석 참고).
initPostHog();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
