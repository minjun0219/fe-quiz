/**
 * Instant navigation shell for `/play`.
 *
 * `page.tsx` is `force-dynamic` (each visit picks a fresh round), so the RSC
 * payload only arrives after a server roundtrip. Without this file, clicking
 * "지금 풀어보기" would sit on the home page until SSR completes — the "한
 * 박자 늦음" symptom. With this file the router renders the skeleton the
 * instant the user clicks, and `<Link>`'s default prefetch can warm this
 * static shell on hover.
 *
 * The skeleton mirrors `round-runner.tsx`'s answering layout (header,
 * progress bar, question, four choices, CTA) so the transition into the
 * real round has no layout jump.
 */
export default function Loading() {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="mb-6 flex items-center justify-between text-sm">
        <span className="h-4 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <span className="h-3 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </header>

      <div className="mb-3 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" />

      <div className="mt-6 mb-4 space-y-3">
        <div className="h-6 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <ul className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <li
            key={i}
            className="h-[60px] animate-pulse rounded-2xl border-2 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </ul>

      <div className="mt-auto pt-10">
        <div className="h-14 w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <span className="sr-only">라운드 불러오는 중…</span>
    </main>
  );
}
