import type { MetadataRoute } from "next";

/**
 * Two indexable pages: the marketing-ish landing and the play entry.
 * `/r/{slug}` URLs are intentionally excluded — see `app/robots.ts`.
 *
 * Vercel auto-fills these env vars; we don't require any manual config:
 *   - VERCEL_PROJECT_PRODUCTION_URL  the stable production domain
 *   - VERCEL_URL                     the per-deployment URL (preview)
 * Same precedence used by `app/api/share/route.ts` for share link hosts.
 */
function siteBase(): string {
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteBase();
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/play`, changeFrequency: "weekly", priority: 0.8 },
  ];
}
