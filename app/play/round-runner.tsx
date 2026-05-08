"use client";

import { useState } from "react";
import type { PublicQuestion } from "@/lib/question.schema";
import type { QuizSubmitResponse } from "@/lib/quiz-submit.schema";
import Result from "./result";

interface Props {
  questions: PublicQuestion[];
}

type Phase =
  | { kind: "answering" }
  | { kind: "submitting" }
  | { kind: "done"; result: QuizSubmitResponse }
  | { kind: "error"; message: string };

export default function RoundRunner({ questions }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [phase, setPhase] = useState<Phase>({ kind: "answering" });

  async function submit() {
    setPhase({ kind: "submitting" });
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question_ids: questions.map((q) => q.id),
          answers,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
      }
      const result = (await res.json()) as QuizSubmitResponse;
      setPhase({ kind: "done", result });
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    }
  }

  if (questions.length === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-3 text-2xl font-bold">아직 시드 문제가 비어있어 😅</h1>
        <p className="text-zinc-600">`content/questions/`에 `.yaml` 추가하고 다시 와줘.</p>
      </main>
    );
  }

  if (phase.kind === "submitting") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 animate-pulse text-sm font-medium text-rose-500">친구가 채점 중…</p>
        <h1 className="text-2xl font-bold">잠깐만, 답 맞춰볼게</h1>
      </main>
    );
  }

  if (phase.kind === "error") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-3 text-2xl font-bold">앗, 채점이 안 됐어 😵</h1>
        <p className="mb-6 max-w-md text-sm text-zinc-600">{phase.message}</p>
        <button
          type="button"
          onClick={submit}
          className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          다시 시도
        </button>
      </main>
    );
  }

  if (phase.kind === "done") {
    return <Result data={phase.result} />;
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
      submit();
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

      <div
        className="mb-3 h-1 overflow-hidden rounded-full bg-zinc-200"
        role="progressbar"
        aria-label="라운드 진행 상황"
        aria-valuenow={index + (canProceed ? 1 : 0)}
        aria-valuemin={0}
        aria-valuemax={questions.length}
      >
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
          className="inline-flex h-14 w-full items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-zinc-800 enabled:active:scale-[0.99]"
        >
          {isLast ? "결과 보기" : "다음 →"}
        </button>
      </div>
    </main>
  );
}
