"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";
import type { Level } from "@/lib/levels";

interface Props {
  level: Level;
  display: string;
  blurb: string;
  isDefault: boolean;
}

export function LevelButton({ level, display, blurb, isDefault }: Props) {
  return (
    <Link
      href={`/play?level=${level}`}
      onClick={() => track("level_selected", { level })}
      className={
        isDefault
          ? "group flex h-16 items-center justify-between rounded-2xl bg-zinc-900 px-6 text-white shadow-md transition hover:bg-zinc-800 active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          : "group flex h-16 items-center justify-between rounded-2xl border border-zinc-200 bg-white px-6 text-zinc-900 transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
      }
    >
      <span className="text-base font-semibold">{display}</span>
      <span
        className={
          isDefault
            ? "text-sm text-zinc-300 dark:text-zinc-500"
            : "text-sm text-zinc-500 dark:text-zinc-400"
        }
      >
        {blurb}
      </span>
    </Link>
  );
}
