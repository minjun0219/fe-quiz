/**
 * 이 배포의 공개 origin — 공유 카드(`og:image`/`og:url`), sitemap처럼 **밖으로
 * 나가는 절대 URL**을 만들 때 쓴다.
 *
 * 우선순위:
 *   1. `SITE_URL` (wrangler.jsonc의 env별 vars) — 의도된 단일 출처
 *   2. 요청이 실제로 들어온 origin — 로컬이면 로컬, 프로덕션이면 프로덕션
 *
 * **하드코딩된 `http://localhost:3000` 폴백을 두지 않는다.** 프로덕션에서
 * `SITE_URL`이 비는 순간 공유 카드에 localhost가 박혀 크롤러가 이미지를
 * 가져오지 못하고, sitemap은 통째로 무의미해진다. 설정이 빠졌을 때 조용히
 * 틀린 URL을 내보내느니 요청 origin을 쓰는 편이 언제나 맞다.
 *
 * 참고: `api/share`는 이 함수를 쓰지 않는다. 거기서 만드는 URL은 **복사돼
 * 남에게 전달되므로** Host 스푸핑을 막는 화이트리스트가 따로 있다. 여기서
 * 만드는 URL은 요청자 본인의 응답에만 실려서 같은 위험이 없다.
 */
export function resolveSiteUrl(request: Request): string {
  const configured = process.env.SITE_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // malformed SITE_URL — 아래 요청 origin으로 폴백
    }
  }
  return new URL(request.url).origin;
}
