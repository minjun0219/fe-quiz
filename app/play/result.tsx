"use client";

import { useState } from "react";
import type { Category } from "@/lib/question.schema";
import type { QuizSubmitResponse } from "@/lib/quiz-submit.schema";

interface Props {
  data: QuizSubmitResponse;
}

const CATEGORY_LABEL: Record<Category, string> = {
  javascript: "JavaScript",
  react: "React",
  css: "CSS",
};

export default function Result({ data }: Props) {
  const [open, setOpen] = useState(false);
  const overallPct = Math.round((data.total_correct / data.total) * 100);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-10">
      <section className="mb-8 text-center">
        <p className="mb-2 text-sm font-medium tracking-wide text-rose-500">오늘의 진단</p>
        <h1 className="mb-3 text-4xl leading-tight font-bold tracking-tight">
          <span className="mr-2">{data.emoji}</span>
          {data.result_type}
        </h1>
        <p className="mb-6 text-base text-zinc-600">{data.blurb}</p>
        <p className="text-2xl font-semibold tabular-nums text-zinc-900">
          {data.total_correct} <span className="text-zinc-400">/</span> {data.total}
          <span className="ml-2 text-base font-medium text-zinc-500">({overallPct}%)</span>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-zinc-500">카테고리별</h2>
        <ul className="flex flex-col gap-3">
          {(
            Object.entries(data.category_scores) as [Category, { correct: number; total: number }][]
          ).map(([cat, score]) => {
            const pct = score.total === 0 ? 0 : Math.round((score.correct / score.total) * 100);
            const isStrong = data.strengths.includes(cat);
            const isWeak = data.weaknesses.includes(cat);
            return (
              <li key={cat} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium text-zinc-700">
                  {CATEGORY_LABEL[cat]}
                </span>
                <div className="flex-1 overflow-hidden rounded-full bg-zinc-200 h-2">
                  <div
                    className={`h-full transition-all ${isStrong ? "bg-emerald-500" : isWeak ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-sm tabular-nums text-zinc-600">
                  {score.correct}/{score.total}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-10">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-700"
        >
          {open ? "▾" : "▸"} 문제 다시 보기
        </button>
        {open && (
          <ol className="flex flex-col gap-4">
            {data.per_question.map((q, i) => (
              <li key={q.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-zinc-400">
                  <span>
                    {i + 1}. {q.category}
                  </span>
                  <span
                    className={
                      q.is_correct
                        ? "font-semibold text-emerald-600"
                        : "font-semibold text-rose-500"
                    }
                  >
                    {q.is_correct ? "정답" : "오답"}
                  </span>
                </div>
                <p className="mb-3 whitespace-pre-line text-base leading-relaxed text-zinc-900">
                  {q.question}
                </p>
                {q.code && (
                  <pre className="mb-3 overflow-x-auto rounded-xl bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100">
                    <code>{q.code}</code>
                  </pre>
                )}
                <ul className="mb-3 flex flex-col gap-1.5 text-sm">
                  {q.choices.map((choice, ci) => {
                    const isCorrect = ci === q.correct_answer;
                    const isYours = ci === q.your_answer;
                    return (
                      <li
                        key={`${q.id}::${choice}`}
                        className={`rounded-lg border px-3 py-2 ${
                          isCorrect
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : isYours
                              ? "border-rose-300 bg-rose-50 text-rose-900"
                              : "border-zinc-200 text-zinc-600"
                        }`}
                      >
                        <span className="mr-2">{isCorrect ? "✓" : isYours ? "✗" : "·"}</span>
                        {choice}
                        {isYours && !isCorrect && (
                          <span className="ml-2 text-xs text-rose-500">(내 답)</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="whitespace-pre-line rounded-xl bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700">
                  {q.explanation}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-auto">
        <button
          type="button"
          disabled
          aria-disabled
          title="다음 PR(공유 플로우)에서 열려요"
          className="inline-flex h-14 w-full cursor-not-allowed items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white opacity-50"
        >
          친구한테 보내기 (곧)
        </button>
      </div>
    </main>
  );
}
