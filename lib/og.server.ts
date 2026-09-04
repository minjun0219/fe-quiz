/**
 * OG 이미지(satori/workers-og) 공용 조각. `share-og`와 홈 카드가 같은 폰트·
 * 캔버스 규격·이스케이프 규칙을 쓰도록 한 곳에 모아둔다.
 *
 * satori 함정은 `AGENTS.md` 참고 — 자식이 2개 이상인 노드에는 `display: flex`가
 * 필수고, 태그 사이 공백도 자식으로 세므로 `compactHtml()`을 우회하지 말 것.
 */

/** OG 표준 캔버스. meta의 og:image:width/height와 반드시 같이 움직인다. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// satori는 woff2를 지원하지 않으므로 woff를 쓴다.
//
// 원본 저장소(`/gh/`)의 raw 경로 대신 Fontsource가 npm에 올린 것을 받는다 —
// 같은 파일(1,129,620 B)인데 모노레포 디렉터리 구조에 묶이지 않는다. 예전
// 경로는 `packages/pretendard/` 프리픽스가 빠지면 404였고, 업스트림이 디렉터리를
// 옮기면 또 깨진다. 이름은 `latin`이지만 unicode-range 서브셋이 아니라 전체
// 자소가 들어 있다(빈 `unicode.json` + 파일 크기가 근거).
const FONT_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/pretendard@5.3.0/files/pretendard-latin-700-normal.woff";

// Cache the font fetch across requests on the same warm isolate. On *any*
// failure (non-2xx, network reject, DNS) we null the cache so the next
// request can retry — otherwise a single transient error would pin a
// rejected promise for the lifetime of the process.
let fontPromise: Promise<ArrayBuffer> | null = null;
export function getFontData(): Promise<ArrayBuffer> {
  if (!fontPromise) {
    fontPromise = fetch(FONT_URL)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Pretendard font fetch failed: ${r.status}`);
        }
        return r.arrayBuffer();
      })
      .catch((err) => {
        fontPromise = null;
        throw err;
      });
  }
  return fontPromise;
}

/**
 * satori는 명시적 flex가 아닌 노드에 자식이 2개 이상이면 throw하는데,
 * 템플릿 리터럴의 들여쓰기/줄바꿈이 텍스트 노드로 파싱돼 자식 수를 부풀린다.
 * 태그 사이 공백을 제거해 마크업 구조만 남긴다.
 */
export function compactHtml(html: string): string {
  return html.replace(/>\s+</g, "><").trim();
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * `ImageResponse` 두 번째 인자. `fontData`가 null이면(서드파티 CDN 장애)
 * satori 내장 sans로 폴백한다 — OG 엔드포인트가 500 나는 것보다 낫다.
 */
export function ogOptions(fontData: ArrayBuffer | null) {
  return {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: fontData
      ? [{ name: "Pretendard", data: fontData, weight: 700 as const }]
      : undefined,
    emoji: "twemoji" as const,
  };
}
