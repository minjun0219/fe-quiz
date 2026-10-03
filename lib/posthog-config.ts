/** 루트 레이아웃이 클라이언트 PostHog 설정을 실어 보내는 `<meta>` 이름들. */
export const POSTHOG_META = {
  key: "posthog-key",
  host: "posthog-host",
  uiHost: "posthog-ui-host",
} as const;

export type PostHogConfig = {
  key: string;
  /** 이벤트 수집 엔드포인트. 없으면 같은 오리진 `/ingest` 프록시(workers/app.ts). */
  apiHost: string;
  /** PostHog UI/툴바 도메인 — ingest 도메인과 다르다. */
  uiHost: string;
};

let cached: PostHogConfig | null | undefined;

/**
 * 클라이언트 PostHog 설정. 빌드에 굽지 않고 서버가 런타임에 `<meta>`로
 * 내려보낸다(root loader → `clientPostHogConfig`). 키가 없으면(로컬·CI·PR
 * 프리뷰) `null` — 모든 호출부가 no-op이 된다.
 *
 * meta는 Layout에 있어 SSR HTML에 이미 들어 있으므로 entry.client가
 * 하이드레이션 전에 읽을 수 있고, 내비게이션으로 바뀌지 않아 처음 값을 캐시한다.
 */
export function getPostHogConfig(): PostHogConfig | null {
  if (typeof document === "undefined") {
    return null;
  }
  if (cached === undefined) {
    const read = (name: string) =>
      document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
        ?.content || null;
    const key = read(POSTHOG_META.key);
    const host = read(POSTHOG_META.host);
    cached = key
      ? {
          key,
          apiHost: host ?? "/ingest",
          uiHost: read(POSTHOG_META.uiHost) ?? deriveUiHost(host),
        }
      : null;
  }
  return cached;
}

/**
 * `ui_host`는 PostHog UI/툴바 도메인(`{region}.posthog.com`)이라 ingest
 * 도메인을 그대로 넣으면 안 됨. PostHog Cloud 호스트면 패턴에서 파생하고,
 * 커스텀 리버스 프록시(z.minjun.kim 등)면 파생 불가라 us 리전으로 폴백.
 */
export function deriveUiHost(host: string | null): string {
  const m = host?.match(/^(https?:\/\/)([a-z]+)\.i\.posthog\.com\/?$/);
  return m ? `${m[1]}${m[2]}.posthog.com` : "https://us.posthog.com";
}
