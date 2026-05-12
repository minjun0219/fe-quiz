import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "찾을 수 없어요 — FE 퀴즈",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <p className="text-sm font-medium tracking-wide text-rose-500">
        🍘 누룽지가 못 찾았어요
      </p>
      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        이 페이지는 사라졌거나 없어요
      </h1>
      <p className="max-w-md text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
        공유 링크가 만료되었거나 주소를 잘못 입력했을 수 있어요. 메인으로
        돌아가서 새 라운드 풀어볼까요?
      </p>
      <Link
        href="/"
        className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        홈으로 가기 →
      </Link>
    </main>
  );
}
