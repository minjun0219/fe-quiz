"use client";

import { useState } from "react";
import type { PublicQuestion } from "@/lib/round";

interface Props {
  questions: PublicQuestion[];
}

export default function RoundRunner({ questions }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);

  if (questions.length === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-3 text-2xl font-bold">아직 시드 문제가 비어있어 😅</h1>
        <p className="text-zinc-600">`content/questions/`에 `.yaml` 추가하고 다시 와줘.</p>
      </main>
    );
  }

  if (submitted) {
    // Step 5에서 /api/quiz/submit + 결과 페이지로 교체될 placeholder
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 text-sm font-medium text-rose-500">친구가 채점 중…</p>
        <h1 className="mb-4 text-3xl font-bold">다 풀었네! 👏</h1>
        <p className="mb-2 max-w-md text-zinc-600">채점이랑 AI 피드백은 다음 PR에서 연결할게.</p>
        <pre className="mt-6 max-w-md whitespace-pre-wrap rounded-2xl bg-zinc-100 p-4 text-left text-xs text-zinc-700">
          {JSON.stringify({ question_ids: questions.map((q) => q.id), answers }, null, 2)}
        </pre>
      </main>
    );
  }

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const selected = answers[index];
  const canProceed = selected !== null;

  function selectChoice(choiceIdx: number) {
    setAnswers((prev) => {
      const next = prev.slice();
      next[index] = choiceIdx;
      return next;
    });
  }

  function next() {
    if (isLast) {
      setSubmitted(true);
      return;
    }
    setIndex((i) => i + 1);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8">
      <header className="mb-6 flex items-center justify-between text-sm">
        <span className="font-medium tabular-nums text-zinc-500">
          {index + 1} / {questions.length}
        </span>
        <span className="text-xs uppercase tracking-wider text-zinc-400">
          {current.category} · {current.difficulty}
        </span>
      </header>

      <div className="mb-3 h-1 overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full bg-rose-500 transition-all"
          style={{
            width: `${((index + (canProceed ? 1 : 0)) / questions.length) * 100}%`,
          }}
        />
      </div>

      <h1 className="mt-6 mb-4 whitespace-pre-line text-xl font-semibold leading-relaxed">
        {current.question}
      </h1>

      {current.code && (
        <pre className="mb-6 overflow-x-auto rounded-2xl bg-zinc-900 p-4 font-mono text-sm leading-relaxed text-zinc-100">
          <code>{current.code}</code>
        </pre>
      )}

      <ul className="flex flex-col gap-3">
        {current.choices.map((choice, i) => {
          const isSelected = selected === i;
          return (
            <li key={`${current.id}::${choice}`}>
              <button
                type="button"
                onClick={() => selectChoice(i)}
                aria-pressed={isSelected}
                className={`w-full rounded-2xl border-2 px-5 py-4 text-left text-base transition active:scale-[0.99] ${
                  isSelected
                    ? "border-rose-500 bg-rose-50 text-zinc-900"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                }`}
              >
                {choice}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-10">
        <button
          type="button"
          onClick={next}
          disabled={!canProceed}
          className="inline-flex h-14 w-full items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 enabled:active:scale-[0.99] enabled:hover:bg-zinc-800"
        >
          {isLast ? "결과 보기" : "다음 →"}
        </button>
      </div>
    </main>
  );
}
