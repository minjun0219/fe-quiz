import { SiteCredit } from "@/components/credits";
import { LevelButton } from "@/components/level-button";
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
        </h1>
        <p className="mb-10 max-w-md text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
          10문제, 5분이면 끝.
        </p>
        <div className="mb-6 flex w-full max-w-md flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            난이도 골라
          </p>
          {LEVELS.map((level) => (
            <LevelButton
              key={level.id}
              level={level.id}
              display={level.display}
              blurb={level.blurb}
              isDefault={level.id === DEFAULT_LEVEL}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          JS · React · CSS · TS · HTML / 약 5분
        </p>
      </div>
      <SiteCredit />
    </main>
  );
}
