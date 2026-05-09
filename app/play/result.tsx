"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORY_DISPLAY_LABEL } from "@/lib/category-labels";
import type { Category } from "@/lib/question.schema";
import type { QuizSubmitResponse } from "@/lib/quiz-submit.schema";
import type { ShareCreateResponse } from "@/lib/share.schema";

interface Props {
  data: QuizSubmitResponse;
}

type FeedbackStatus = "loading" | "streaming" | "done" | "error" | "unavailable";
type ShareStatus = "idle" | "creating" | "error";

function matches(target: string | string[] | null, id: string): boolean {
  if (target === null) return false;
  return Array.isArray(target) ? target.includes(id) : target === id;
}

export default function Result({ data }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("loading");
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const overallPct = Math.round((data.total_correct / data.total) * 100);

  // Share is enabled once the feedback flow has settled in any terminal
  // state — including "error" / "unavailable", where we'll fall back to a
  // stub message so a transient Anthropic outage doesn't block the core
  // share flow.
  const canShare = feedbackStatus !== "loading" && feedbackStatus !== "streaming";

  async function handleShare() {
    if (!canShare || shareStatus === "creating") return;
    setShareStatus("creating");
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question_ids: data.per_question.map((q) => q.id),
          answers: data.per_question.map((q) => q.your_answer),
          // If feedback failed/unavailable, send a stub so the share endpoint
          // (which requires non-empty feedback) accepts it. Hard-cap to the
          // server's 2000-char schema limit so a chatty model can't 400.
          feedback: (feedback.trim() || "(친구가 자리 비웠을 때 만든 결과)").slice(0, 2000),
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const body = (await res.json()) as ShareCreateResponse;
      router.push(`/r/${body.slug}`);
    } catch {
      setShareStatus("error");
    }
  }

  useEffect(() => {
    // Reset on every dep change so a new round (different `data`) gets a
    // fresh stream instead of accumulating on top of the previous one. The
    // `ignore` flag guards against StrictMode double-invoke + late updates
    // from a stale effect.
    setFeedback("");
    setFeedbackStatus("loading");
    let ignore = false;
    const abort = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/quiz/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question_ids: data.per_question.map((q) => q.id),
            answers: data.per_question.map((q) => q.your_answer),
          }),
          signal: abort.signal,
        });
        if (res.status === 503) {
          if (!ignore) setFeedbackStatus("unavailable");
          return;
        }
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        if (!ignore) setFeedbackStatus("streaming");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done || ignore) break;
          setFeedback((prev) => prev + decoder.decode(value, { stream: true }));
        }
        // Flush any byte sequence that was held back on a UTF-8 boundary —
        // Korean characters are 3 bytes, easy to bisect across chunks.
        if (!ignore) {
          const tail = decoder.decode();
          if (tail) setFeedback((prev) => prev + tail);
          setFeedbackStatus("done");
        }
      } catch (err) {
        if (ignore || (err as { name?: string }).name === "AbortError") return;
        setFeedbackStatus("error");
      }
    })();

    return () => {
      ignore = true;
      abort.abort();
    };
  }, [data]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-10">
      <section className="mb-8 text-center">
        <p className="mb-2 text-sm font-medium tracking-wide text-rose-500">오늘의 진단</p>
        <h1 className="mb-2 text-4xl leading-tight font-bold tracking-tight">
          <span className="mr-2">{data.emoji}</span>
          {data.result_type}
        </h1>
        <p className="mb-3">
          <span className="inline-block rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold tracking-wider text-zinc-700 tabular-nums">
            {data.type_code}
          </span>
          <span className="ml-2 text-xs text-zinc-500">
            {data.personality === "balanced" ? "균형형" : "편식형"}
          </span>
        </p>
        <p className="mb-2 text-base text-zinc-600">{data.blurb}</p>
        <p className="mb-6 text-sm text-zinc-500">
          <span className="mr-1">{data.vibe.emoji}</span>
          {data.vibe.blurb}
        </p>
        <p className="text-2xl font-semibold tabular-nums text-zinc-900">
          {data.total_correct} <span className="text-zinc-400">/</span> {data.total}
          <span className="ml-2 text-base font-medium text-zinc-500">({overallPct}%)</span>
        </p>
      </section>

      <section className="mb-8 rounded-2xl border border-rose-100 bg-rose-50/40 p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-rose-500 uppercase">
          <span>친구의 한마디</span>
          {feedbackStatus === "loading" && (
            <span className="animate-pulse text-zinc-400 normal-case">생각 중…</span>
          )}
          {feedbackStatus === "streaming" && (
            <span className="animate-pulse text-zinc-400 normal-case">타이핑 중…</span>
          )}
        </div>
        {feedbackStatus === "error" && (
          <p className="text-sm text-zinc-500">
            앗 친구가 잠깐 자리 비웠어. 새로고침하면 다시 와줄지도 🤞
          </p>
        )}
        {feedbackStatus === "unavailable" && (
          <p className="text-sm text-zinc-500">
            (개발자에게: <code className="rounded bg-zinc-100 px-1">ANTHROPIC_API_KEY</code>를
            <code className="ml-1 rounded bg-zinc-100 px-1">.env.local</code>에 넣으면 친구가
            깨어나요)
          </p>
        )}
        {feedback && (
          <p className="whitespace-pre-line text-base leading-relaxed text-zinc-800">
            {feedback}
            {feedbackStatus === "streaming" && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-rose-400 align-middle" />
            )}
          </p>
        )}
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
                  {CATEGORY_DISPLAY_LABEL[cat]}
                </span>
                <div className="flex-1 overflow-hidden rounded-full bg-zinc-200 h-2">
                  <div
                    className={`h-full transition-all ${isStrong ? "bg-emerald-500" : isWeak ? "bg-rose-500" : "bg-amber-500"}`}
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
          aria-expanded={open}
          aria-controls="result-questions"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-700"
        >
          {open ? "▾" : "▸"} 문제 다시 보기
        </button>
        {open && (
          <ol id="result-questions" className="flex flex-col gap-4">
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
                {q.code_html ? (
                  <div
                    className="quiz-code-block mb-3 overflow-x-auto rounded-xl bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output of our own YAML seed; no user input.
                    dangerouslySetInnerHTML={{ __html: q.code_html }}
                  />
                ) : (
                  q.code && (
                    <pre className="mb-3 overflow-x-auto rounded-xl bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100">
                      <code>{q.code}</code>
                    </pre>
                  )
                )}
                <ul className="mb-3 flex flex-col gap-1.5 text-sm">
                  {q.choices.map((choice) => {
                    const isCorrect = matches(q.correct_answer, choice.id);
                    const isYours = matches(q.your_answer, choice.id);
                    return (
                      <li
                        key={`${q.id}::${choice.id}`}
                        className={`rounded-lg border px-3 py-2 ${
                          isCorrect
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : isYours
                              ? "border-rose-300 bg-rose-50 text-rose-900"
                              : "border-zinc-200 text-zinc-600"
                        }`}
                      >
                        <span className="mr-2">{isCorrect ? "✓" : isYours ? "✗" : "·"}</span>
                        {choice.text}
                        {isYours && !isCorrect && (
                          <span className="ml-2 text-xs text-rose-500">(내 답)</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {q.explanation_html ? (
                  <p
                    className="whitespace-pre-line rounded-xl bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML-escaped server-side from our own YAML seed; only inline-code wrappers are injected.
                    dangerouslySetInnerHTML={{ __html: q.explanation_html }}
                  />
                ) : (
                  <p className="whitespace-pre-line rounded-xl bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700">
                    {q.explanation}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          onClick={handleShare}
          disabled={!canShare || shareStatus === "creating"}
          className="inline-flex h-14 w-full items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-zinc-800 enabled:active:scale-[0.99]"
        >
          {shareStatus === "creating"
            ? "공유 만드는 중…"
            : !canShare
              ? "친구의 한마디 기다리는 중…"
              : "친구한테 보내기 →"}
        </button>
        {shareStatus === "error" && (
          <p className="text-center text-sm text-rose-500">
            공유 만들기에 실패했어. 잠시 후 다시 눌러봐.
          </p>
        )}
      </div>
    </main>
  );
}
