/**
 * Instant navigation shell for `/play`.
 *
 * `page.tsx` is `force-dynamic` (each visit picks a fresh round), so the RSC
 * payload only arrives after a server roundtrip. Without this file, clicking
 * "지금 풀어보기" would sit on the home page until SSR completes — the "한
 * 박자 늦음" symptom. With this file the router renders this shell the
 * instant the user clicks, and `<Link>`'s default prefetch can warm it on
 * hover.
 *
 * Voice + layout intentionally mirror the `submitting` screen in
 * `round-runner.tsx` ("친구가 채점 중… / 잠깐만, 답 맞춰볼게") so the
 * transitions home → loading → round → submitting → result feel like one
 * coherent friend-running-the-quiz flow.
 */
export default function Loading() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="mb-3 animate-pulse text-sm font-medium text-rose-500">친구가 문제 고르는 중…</p>
      <h1 className="text-2xl font-bold">잠깐만, 문제 가져올게</h1>
    </main>
  );
}
