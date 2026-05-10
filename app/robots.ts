import type { MetadataRoute } from "next";

/**
 * `/r/{slug}` is a private 1-to-1 share link generated per round result.
 * We don't want search engines surfacing arbitrary friends' results, so
 * those routes are disallowed. The home page and play entry are open.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/play"],
        disallow: ["/r/"],
      },
    ],
  };
}
