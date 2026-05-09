import Link from "next/link";
import { SiteCredit } from "@/components/credits";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col px-6 py-10 text-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="mb-3 text-sm font-medium tracking-wide text-rose-500">
          친구가 내는 프론트엔드 퀴즈
        </p>
        <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          10문제만 풀어봐.
          <br />
          얼마나 알고 있는지.
        </h1>
        <p className="mb-10 max-w-md text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
          면접 압박 없이, 단톡방에서 친구 던지듯.
          <br />다 풀면 AI가 친구처럼 피드백 + MBTI식 결과 타입까지 알려줘.
        </p>
        <Link
          href="/play"
          className="inline-flex h-14 items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          지금 풀어보기 →
        </Link>
        <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500">JS · React · CSS / 약 5분</p>
      </div>
      <SiteCredit />
    </main>
  );
}
