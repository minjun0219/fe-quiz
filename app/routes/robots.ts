/**
 * `/r/{slug}` is a private 1-to-1 share link generated per round result.
 * We don't want search engines surfacing arbitrary friends' results, so
 * those routes are disallowed. The home page and play entry are open.
 */
export function loader() {
  const body = ["User-Agent: *", "Allow: /", "Allow: /play", "Disallow: /r/"]
    .join("\n")
    .concat("\n");
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
