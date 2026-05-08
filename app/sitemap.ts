import type { MetadataRoute } from "next";

/**
 * Two indexable pages: the marketing-ish landing and the play entry.
 * `/r/{slug}` URLs are intentionally excluded — see `app/robots.ts`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/play`, changeFrequency: "weekly", priority: 0.8 },
  ];
}
