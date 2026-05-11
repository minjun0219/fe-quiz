"use client";

import { useId, useState } from "react";
import { CodeBlock } from "@/components/code-block";
import type { Level } from "@/lib/levels";
import type { PublicQuestion } from "@/lib/question.schema";
import type {
  QuizSubmitResponse,
  SubmittedAnswer,
} from "@/lib/quiz-submit.schema";
import Result from "./result";

interface Props {
  questions: PublicQuestion[];
  level: Level;
}

type Phase =
  | { kind: "answering" }
  | { kind: "submitting" }
  | { kind: "done"; result: QuizSubmitResponse }
  | { kind: "error"; message: string };

/**
 * Per-question working state. `null` means untouched. For multi_choice we keep
 * an array even before any pick so the toggle handler can stay shape-stable;
 * an empty array submits as `null` to mean "skipped".
 */
type AnswerState = string | string[] | null;

function initialAnswers(questions: PublicQuestion[]): AnswerState[] {
  return questions.map((q) => (q.type === "multi_choice" ? [] : null));
}

function canProceed(q: PublicQuestion, a: AnswerState): boolean {
  if (q.type === "multi_choice") {
    return Array.isArray(a) && a.length > 0;
  }
  return typeof a === "string";
}

function normalize(a: AnswerState): SubmittedAnswer {
  if (Array.isArray(a)) {
    return a.length === 0 ? null : a;
  }
  return a;
}

export default function RoundRunner({ questions, level }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    initialAnswers(questions),
  );
  const [phase, setPhase] = useState<Phase>({ kind: "answering" });
  const groupNameBase = useId();

  async function submit() {
    setPhase({ kind: "submitting" });
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question_ids: questions.map((q) => q.id),
          answers: answers.map(normalize),
          displayed_choice_ids: questions.map((q) =>
            q.choices.map((c) => c.id),
          ),
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
        <h1 className="mb-3 text-2xl font-bold">
          아직 시드 문제가 비어있어 😅
        </h1>
        <p className="text-zinc-600 dark:text-zinc-300">
          `content/questions/`에 `.yaml` 추가하고 다시 와줘.
        </p>
      </main>
    );
  }

  if (phase.kind === "submitting") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 animate-pulse text-sm font-medium text-rose-500">
          누룽지가 채점 중…
        </p>
        <h1 className="text-2xl font-bold">잠깐만, 답 맞춰볼게</h1>
      </main>
    );
  }

  if (phase.kind === "error") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-3 text-2xl font-bold">앗, 채점이 안 됐어 😵</h1>
        <p className="mb-6 max-w-md text-sm text-zinc-600 dark:text-zinc-300">
          {phase.message}
        </p>
        <button
          type="button"
          onClick={submit}
          className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          다시 시도
        </button>
      </main>
    );
  }

  if (phase.kind === "done") {
    return <Result data={phase.result} level={level} />;
  }

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const selected = answers[index];
  const isMulti = current.type === "multi_choice";
  const proceed = canProceed(current, selected);
  // Radio inputs need a shared `name` to form an exclusive group; making it
  // unique per question prevents cross-question interference if two rounds
  // ever share the same DOM (StrictMode remounts, etc.).
  const radioGroupName = `${groupNameBase}-${current.id}`;

  function toggleChoice(choiceId: string) {
    setAnswers((prev) => {
      const next = prev.slice();
      if (current.type === "multi_choice") {
        const arr = Array.isArray(prev[index]) ? (prev[index] as string[]) : [];
        next[index] = arr.includes(choiceId)
          ? arr.filter((id) => id !== choiceId)
          : [...arr, choiceId];
      } else {
        next[index] = choiceId;
      }
      return next;
    });
  }

  function isChoiceSelected(choiceId: string): boolean {
    if (Array.isArray(selected)) {
      return selected.includes(choiceId);
    }
    return selected === choiceId;
  }

  function scrollToTop() {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function nextStep() {
    scrollToTop();
    if (isLast) {
      submit();
      return;
    }
    setIndex((i) => i + 1);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8">
      <header className="mb-6 flex items-center justify-between text-sm">
        <span className="font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
          {index + 1} / {questions.length}
        </span>
        <span className="text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {current.category} · {current.difficulty}
          {isMulti && <span className="ml-2 text-rose-500">· 복수 선택</span>}
        </span>
      </header>

      <div
        className="mb-3 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-label="라운드 진행 상황"
        aria-valuenow={index + (proceed ? 1 : 0)}
        aria-valuemin={0}
        aria-valuemax={questions.length}
      >
        <div
          className="h-full bg-rose-500 transition-all"
          style={{
            width: `${((index + (proceed ? 1 : 0)) / questions.length) * 100}%`,
          }}
        />
      </div>

      <fieldset className="contents">
        {current.question_html ? (
          <legend
            className="mt-6 mb-4 text-xl font-semibold leading-relaxed"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered by `renderQuizMarkdown` from our own YAML seed (no user input); only inline-code spans, <strong>, and HTML-escaped <pre><code> from fenced blocks are injected.
            dangerouslySetInnerHTML={{ __html: current.question_html }}
          />
        ) : (
          <legend className="mt-6 mb-4 text-xl font-semibold leading-relaxed">
            {current.question}
          </legend>
        )}

        <CodeBlock
          code={current.code}
          highlightedCodeHtml={current.code_html}
          size="sm"
          className="mb-6"
        />

        {isMulti && (
          <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            정답이 여러 개일 수 있어. 해당하는 걸 모두 골라줘.
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {current.choices.map((choice) => {
            const isSelected = isChoiceSelected(choice.id);
            const inputId = `${groupNameBase}-${current.id}-${choice.id}`;
            return (
              <li key={`${current.id}::${choice.id}`}>
                <input
                  id={inputId}
                  type={isMulti ? "checkbox" : "radio"}
                  name={isMulti ? inputId : radioGroupName}
                  value={choice.id}
                  checked={isSelected}
                  onChange={() => toggleChoice(choice.id)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={inputId}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 px-5 py-4 text-left text-base transition active:scale-[0.99] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-rose-500 ${
                    isSelected
                      ? "border-rose-500 bg-rose-50 text-zinc-900 dark:bg-rose-500/10 dark:text-zinc-50"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${
                      isMulti ? "rounded-md" : "rounded-full"
                    } ${
                      isSelected
                        ? "border-rose-500 bg-rose-500 text-white"
                        : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
                    }`}
                  >
                    {isSelected &&
                      (isMulti ? (
                        "✓"
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      ))}
                  </span>
                  {choice.text_html ? (
                    <span
                      className="flex-1"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered by `renderQuizMarkdown` from our own YAML seed (no user input); only inline-code spans, <strong>, and HTML-escaped <pre><code> from fenced blocks are injected.
                      dangerouslySetInnerHTML={{ __html: choice.text_html }}
                    />
                  ) : (
                    <span className="flex-1">{choice.text}</span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="mt-auto pt-10">
        <button
          type="button"
          onClick={nextStep}
          disabled={!proceed}
          className="inline-flex h-14 w-full items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-zinc-800 enabled:active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-900 dark:enabled:hover:bg-zinc-200"
        >
          {isLast ? "결과 보기" : "다음 →"}
        </button>
      </div>
    </main>
  );
}
