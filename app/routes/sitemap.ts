/**
 * Two indexable pages: the marketing-ish landing and the play entry.
 * `/r/{slug}` URLs are intentionally excluded — see `routes/robots.ts`.
 * base URL은 wrangler.jsonc env별 `SITE_URL` var에서.
 */
export function loader() {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  const urls = [
    { loc: base, changefreq: "monthly", priority: "1" },
    { loc: `${base}/play`, changefreq: "weekly", priority: "0.8" },
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join("\n")}
</urlset>
`;
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
