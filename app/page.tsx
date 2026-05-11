import Link from "next/link";
import { SiteCredit } from "@/components/credits";
import { DEFAULT_LEVEL, LEVELS } from "@/lib/levels";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col px-6 py-10 text-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="mb-3 text-sm font-medium tracking-wide text-rose-500">
          가볍게 풀어보는 프론트엔드 퀴즈
        </p>
        <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          10문제만 풀어봐.
          <br />
          얼마나 알고 있는지.
        </h1>
        <p className="mb-10 max-w-md text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
          10문제, 5분이면 끝.
        </p>
        <div className="mb-6 flex w-full max-w-md flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            난이도 골라
          </p>
          {LEVELS.map((level) => {
            const isDefault = level.id === DEFAULT_LEVEL;
            return (
              <Link
                key={level.id}
                href={`/play?level=${level.id}`}
                className={
                  isDefault
                    ? "group flex h-16 items-center justify-between rounded-2xl bg-zinc-900 px-6 text-white shadow-md transition hover:bg-zinc-800 active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    : "group flex h-16 items-center justify-between rounded-2xl border border-zinc-200 bg-white px-6 text-zinc-900 transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                }
              >
                <span className="text-base font-semibold">{level.display}</span>
                <span
                  className={
                    isDefault
                      ? "text-sm text-zinc-300 dark:text-zinc-500"
                      : "text-sm text-zinc-500 dark:text-zinc-400"
                  }
                >
                  {level.blurb}
                </span>
              </Link>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          JS · React · CSS · TS · HTML / 약 5분
        </p>
      </div>
      <SiteCredit />
    </main>
  );
}
