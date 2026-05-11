<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:tailwind-agent-rules -->
# This is NOT the Tailwind you know

Tailwind v4. There is no `tailwind.config.js` — theme tokens live in `app/globals.css` via `@theme inline`, and the entry is `@import "tailwindcss"`. Do not generate a config file or fall back to v3 plugin/preset patterns. Check `app/globals.css` and the v4 docs before reaching for utilities.
<!-- END:tailwind-agent-rules -->

<!-- BEGIN:zod-agent-rules -->
# This is NOT the Zod you know

Zod v4. Error shapes and several APIs differ from v3 — inspect `result.error.issues`, not `.errors`/`.message`, and verify any `z.*` helper before use. Existing schemas live in `lib/*.schema.ts`; mirror their patterns and consult the v4 docs before introducing new ones.
<!-- END:zod-agent-rules -->

<!-- BEGIN:react-agent-rules -->
# This is NOT the React you know

React 19. Server Components are the default in this codebase; client interactivity is rare. Don't reach for `use()`, `useActionState`, or form actions unless you've read the React 19 docs and confirmed the API — your training data is likely wrong about them.
<!-- END:react-agent-rules -->

<!-- BEGIN:tooling-agent-rules -->
# Tooling: Biome v2, Vitest v4, pnpm 10

No ESLint, no Prettier — `biome.json` is the single source for lint and format, and `noConsole` is enforced (use `lib/logger.ts` / pino instead). Tests run in Node only (`vitest.config.ts`, `environment: "node"`); DOM tests are not configured. Package manager is pnpm via corepack — do not run `npm` or `yarn`.
<!-- END:tooling-agent-rules -->

<!-- BEGIN:project-agent-rules -->
# Project conventions you will get wrong by guessing

- **Single sources of truth** — touch these once when adding categories / levels / round size:
  - `lib/categories.ts` (category list + id prefixes)
  - `lib/levels.ts` (three difficulty levels)
  - `lib/round-picker.ts` (`ROUND_SIZE = 10`)
- **`server-only` boundary**: `lib/supabase.ts`, `lib/rate-limit.ts`, `lib/posthog-server.ts`, `lib/logger.ts` all import `"server-only"`. Never import them from client components.
- **Env branching uses `VERCEL_ENV`, NOT `NODE_ENV`** — `next start` sets `NODE_ENV=production` locally and would otherwise hit prod Supabase. See `lib/supabase.ts`.
- **No client-side answer leakage**: the `PublicQuestion` shape strips `answer` and `explanation`; scoring is server-side. Don't add answer fields to anything served to the browser.
- **Optional integrations are no-op / fail-open** when env is unset: Upstash rate limit, PostHog (server + client), Anthropic. Do not turn these into hard requirements.
- **YAML content is schema-validated**: run `pnpm questions:check` after any edit under `content/questions/`. Prose/code style is enforced — see `docs/CONTENT_STYLE.md`.

For deeper context, read `docs/ROADMAP.md` and `docs/CONTENT_STYLE.md` before non-trivial changes.
<!-- END:project-agent-rules -->
