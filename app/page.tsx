export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-3 text-sm font-medium tracking-wide text-rose-500">
        친구가 내는 프론트엔드 퀴즈
      </p>
      <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        5문제만 풀어봐.
        <br />
        얼마나 알고 있는지.
      </h1>
      <p className="mb-10 max-w-md text-base leading-relaxed text-zinc-600">
        면접 압박 없이, 단톡방에서 친구 던지듯.
        <br />
        다 풀면 AI가 친구처럼 피드백 줘.
      </p>
      <button
        type="button"
        disabled
        aria-disabled
        title="다음 PR에서 열려요"
        className="inline-flex h-14 cursor-not-allowed items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white opacity-60"
      >
        곧 시작 ✨
      </button>
      <p className="mt-6 text-xs text-zinc-400">JS · React · CSS / 약 3분</p>
    </main>
  );
}
