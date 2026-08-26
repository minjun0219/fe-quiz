import posthog from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";
import { useEffect } from "react";
import { useLocation } from "react-router";

const RAW_HOST = import.meta.env.VITE_POSTHOG_HOST;

/**
 * 이벤트 수집 엔드포인트. `VITE_POSTHOG_HOST`가 있으면 그 호스트로 직접
 * (production은 리버스 프록시 z.minjun.kim — 수집 트래픽이 워커 할당량을 안
 * 먹음), 없으면 같은 오리진 `/ingest` 프록시(workers/app.ts)로 폴백 (로컬 dev).
 */
export const POSTHOG_API_HOST = RAW_HOST ?? "/ingest";

/**
 * `ui_host`는 PostHog UI/툴바 도메인(`{region}.posthog.com`)이라 ingest
 * 도메인을 그대로 넣으면 안 됨. PostHog Cloud 호스트면 패턴에서 파생하고,
 * 커스텀 리버스 프록시(z.minjun.kim 등)면 파생 불가라 us 리전으로 폴백.
 */
export const POSTHOG_UI_HOST = (() => {
  const m = RAW_HOST?.match(/^(https?:\/\/)([a-z]+)\.i\.posthog\.com\/?$/);
  return m ? `${m[1]}${m[2]}.posthog.com` : "https://us.posthog.com";
})();

/**
 * 클라이언트 PostHog 초기화. **entry.client.tsx가 하이드레이션 전에 호출**한다
 * — React effect에서 init하면 자식 effect(PageviewTracker, RoundRunner의
 * track 큐)가 부모 init보다 먼저 돌아 첫 $pageview가 영구 드롭되고, init이
 * 큐 드레인 타임아웃(~1s)보다 늦으면 라운드 이벤트도 버려진다. 하이드레이션
 * 전에 끝내면 모든 effect 시점에 `__loaded`가 보장된다.
 *
 * - 키 미설정 시 no-op — dev/CI에서 throw 없음.
 * - 익명 가입 없는 제품이라 identified_only로 설정해 봇/무지성 방문이
 *   사용자 카운트를 부풀리지 않도록 함.
 * - 세션 리플레이: form 입력은 전부 마스킹(`maskAllInputs`), 텍스트는 기본
 *   노출이고 민감한 영역에 `data-ph-mask` 속성을 붙여 opt-in 마스킹. 이 앱은
 *   퀴즈 콘텐츠가 본질적으로 공개 텍스트라 default-mask는 디버깅만 어렵게 함.
 */
export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) {
    return;
  }
  if (posthog.__loaded) {
    return;
  }

  posthog.init(key, {
    api_host: POSTHOG_API_HOST,
    ui_host: POSTHOG_UI_HOST,
    person_profiles: "identified_only",
    capture_pageview: false, // 라우트 변경 직접 감지 (아래 PageviewTracker)
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
    },
  });
}

/** 클라이언트 PostHog 프로바이더 — init은 entry.client에서 이미 끝난 상태. */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider client={posthog}>
      <PageviewTracker />
      {children}
    </Provider>
  );
}

/**
 * SPA 내비게이션에서는 페이지가 unmount되지 않으므로 location 변경을 직접
 * 관찰해 `$pageview`를 캡처한다. RR의 `useLocation`은 pathname+search를 한
 * 번에 주므로 (Next와 달리) Suspense 경계도 필요 없다.
 */
function PageviewTracker() {
  const location = useLocation();

  useEffect(() => {
    if (!posthog.__loaded) {
      return;
    }
    const url = location.search
      ? `${location.pathname}${location.search}`
      : location.pathname;
    posthog.capture("$pageview", { $current_url: url });
  }, [location.pathname, location.search]);

  return null;
}
