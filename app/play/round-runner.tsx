import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { CodeBlock } from "@/components/code-block";
import { track } from "@/lib/analytics";
import type { Level } from "@/lib/levels";
import type { Difficulty, PublicQuestion } from "@/lib/question.schema";
import type {
  QuizSubmitResponse,
  SubmittedAnswer,
} from "@/lib/quiz-submit.schema";
import Result from "./result";

interface Props {
  questions: PublicQuestion[];
  level: Level;
  replay: boolean;
}

function selectionCount(a: AnswerState): number {
  if (a === null) {
    return 0;
  }
  return Array.isArray(a) ? a.length : 1;
}

function difficultyMix(
  questions: PublicQuestion[],
): Record<Difficulty, number> {
  const mix: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const q of questions) {
    mix[q.difficulty] += 1;
  }
  return mix;
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

/** `?q=` 파싱. 빠졌거나 쓰레기값이면 첫 문항. */
function parseCursor(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * `?q=`만 갈아끼운 새 파라미터. level·from 같은 라운드 파라미터는 보존한다.
 * 첫 문항은 `q` 없는 URL이 정규형 — 그래야 라운드 진입 직후의 뒤로가기
 * 한 번이 정확히 홈으로 나간다.
 */
function withCursor(prev: URLSearchParams, index: number): URLSearchParams {
  const next = new URLSearchParams(prev);
  if (index === 0) {
    next.delete("q");
  } else {
    next.set("q", String(index));
  }
  return next;
}

/**
 * URL로 도달할 수 있는 가장 뒤쪽 문항. "다음" 버튼과 같은 규칙 — 앞 문항을
 * 모두 답해야 그 다음으로 갈 수 있다. `?q=9`를 직접 입력하거나 그 URL에서
 * 새로고침해도(=답이 전부 비어 있음) 건너뛰기가 되지 않게 막는 클램프다.
 */
function reachableLimit(
  questions: PublicQuestion[],
  answers: AnswerState[],
): number {
  for (let i = 0; i < questions.length; i += 1) {
    if (!canProceed(questions[i], answers[i])) {
      return i;
    }
  }
  return questions.length - 1;
}

export default function RoundRunner({ questions, level, replay }: Props) {
  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    initialAnswers(questions),
  );
  const [phase, setPhase] = useState<Phase>({ kind: "answering" });
  const groupNameBase = useId();
  // `round_started` 와 `round_submitted` 의 경과시간 측정용. round 동안
  // 변하지 않는 값이라 ref로 충분.
  const roundStartedAtRef = useRef<number>(Date.now());
  const questionViewedAtRef = useRef<number>(Date.now());
  // 이미 본 / 이미 답을 확정한 index. 재방문 여부를 이벤트에 실어 보내
  // 퍼널이 index당 1회만 세도록 거를 수 있게 한다.
  const seenRef = useRef<Set<number>>(new Set());
  const answeredRef = useRef<Set<number>>(new Set());

  // 현재 문항은 URL(`?q=`)이 단일 출처다. 컴포넌트 state로 두면 브라우저
  // 뒤로가기가 /play 자체를 벗어나 라운드가 통째로 날아간다 — 문제 세트가
  // 랜덤이라 되돌아와도 복구되지 않는다.
  const [searchParams, setSearchParams] = useSearchParams();
  const limit = reachableLimit(questions, answers);
  const cursor = parseCursor(searchParams.get("q"));
  const index = Math.min(cursor, limit);

  /** 스크롤은 scrollToTop()이 직접 관리하므로 라우터 복원은 끈다. */
  function goTo(nextIndex: number) {
    setSearchParams((prev) => withCursor(prev, nextIndex), {
      preventScrollReset: true,
    });
  }

  // 화면은 클램프됐는데 URL만 앞서 있는 상태를 정리한다(`?q=9` 직접 진입,
  // 라운드 중간 새로고침 등 — 새로고침은 랜덤 세트를 새로 뽑으므로 커서가
  // 통째로 무의미해진다). 히스토리를 늘리지 않도록 replace.
  useEffect(() => {
    if (cursor === index) {
      return;
    }
    setSearchParams((prev) => withCursor(prev, index), {
      preventScrollReset: true,
      replace: true,
    });
  }, [cursor, index, setSearchParams]);

  useEffect(() => {
    if (questions.length === 0) {
      return;
    }
    roundStartedAtRef.current = Date.now();
    track("round_started", {
      level,
      question_count: questions.length,
      question_ids: questions.map((q) => q.id),
      categories: questions.map((q) => q.category),
      difficulties: questions.map((q) => q.difficulty),
      mix: difficultyMix(questions),
      replay,
    });
  }, [questions, level, replay]);

  // 문항이 바뀔 때마다(앞으로든 뒤로든) 조회 이벤트 + dwell 타이머 리셋.
  useEffect(() => {
    if (questions.length === 0) {
      return;
    }
    const q = questions[index];
    questionViewedAtRef.current = Date.now();
    const isRevisit = seenRef.current.has(index);
    seenRef.current.add(index);
    track("question_viewed", {
      level,
      index,
      question_id: q.id,
      category: q.category,
      difficulty: q.difficulty,
      question_type: q.type,
      is_revisit: isRevisit,
    });
  }, [questions, index, level]);

  async function submit() {
    const submittedAt = Date.now();
    track("round_submitted", {
      level,
      round_duration_ms: submittedAt - roundStartedAtRef.current,
      question_count: questions.length,
    });
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
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      track("round_submit_failed", { level, message });
      setPhase({
        kind: "error",
        message,
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
    const now = Date.now();
    const isRevision = answeredRef.current.has(index);
    answeredRef.current.add(index);
    track("question_answered", {
      level,
      index,
      question_id: current.id,
      category: current.category,
      difficulty: current.difficulty,
      question_type: current.type,
      dwell_ms: now - questionViewedAtRef.current,
      selection_count: selectionCount(selected),
      is_revision: isRevision,
    });
    scrollToTop();
    if (isLast) {
      submit();
      return;
    }
    // `question_viewed`와 dwell 타이머는 index 변경 effect가 맡는다.
    goTo(index + 1);
  }

  function prevStep() {
    scrollToTop();
    goTo(index - 1);
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

      <div className="mt-auto flex items-center gap-3 pt-10">
        {index > 0 && (
          <button
            type="button"
            onClick={prevStep}
            className="inline-flex h-14 shrink-0 items-center justify-center rounded-full border-2 border-zinc-200 px-6 text-base font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 active:scale-[0.99] dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-50"
          >
            ← 이전
          </button>
        )}
        <button
          type="button"
          onClick={nextStep}
          disabled={!proceed}
          className="inline-flex h-14 flex-1 items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-zinc-800 enabled:active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-900 dark:enabled:hover:bg-zinc-200"
        >
          {isLast ? "결과 보기" : "다음 →"}
        </button>
      </div>
    </main>
  );
}
