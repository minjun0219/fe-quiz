"use client";

import { useEffect, useRef, useState } from "react";
import { CodeBlock } from "@/components/code-block";
import { ContributeNote } from "@/components/credits";
import { CATEGORY_DISPLAY_LABEL } from "@/lib/category-labels";
import type { Category } from "@/lib/question.schema";
import type { QuizSubmitResponse } from "@/lib/quiz-submit.schema";
import type { ShareCreateResponse } from "@/lib/share.schema";

interface Props {
  data: QuizSubmitResponse;
}

type FeedbackStatus =
  | "loading"
  | "streaming"
  | "done"
  | "error"
  | "unavailable";
type ShareStatus = "idle" | "creating" | "ready" | "error";
type CopyStatus = "idle" | "copied";

function matches(target: string | string[] | null, id: string): boolean {
  if (target === null) {
    return false;
  }
  return Array.isArray(target) ? target.includes(id) : target === id;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallthrough — caller falls back to manual select-all */
  }
  return false;
}

export default function Result({ data }: Props) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] =
    useState<FeedbackStatus>("loading");
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  // navigator.share availability is detected after mount so SSR / non-secure
  // contexts don't render a button that does nothing.
  const [canNativeShare, setCanNativeShare] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overallPct = Math.round((data.total_correct / data.total) * 100);

  // Share is enabled once the feedback flow has settled in any terminal
  // state — including "error" / "unavailable", where we'll fall back to a
  // stub message so a transient Anthropic outage doesn't block the core
  // share flow.
  const canShare =
    feedbackStatus !== "loading" && feedbackStatus !== "streaming";

  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) {
        clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  function flashCopiedFeedback() {
    setCopyStatus("copied");
    if (copyResetRef.current) {
      clearTimeout(copyResetRef.current);
    }
    copyResetRef.current = setTimeout(() => setCopyStatus("idle"), 1500);
  }

  async function handleShare() {
    if (!canShare || shareStatus === "creating" || shareStatus === "ready") {
      return;
    }
    setShareStatus("creating");
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question_ids: data.per_question.map((q) => q.id),
          answers: data.per_question.map((q) => q.your_answer),
          // If feedback failed/unavailable, send a stub so the share endpoint
          // (which requires non-empty feedback) accepts it. The schema rejects
          // anything > 2000 chars with a 400; clamp here so a rare runaway
          // generation can't block the user from sharing.
          feedback: (
            feedback.trim() || "(친구가 자리 비웠을 때 만든 결과)"
          ).slice(0, 2000),
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const body = (await res.json()) as ShareCreateResponse;
      setShareUrl(body.url);
      setShareStatus("ready");
      const ok = await copyToClipboard(body.url);
      if (ok) {
        flashCopiedFeedback();
      }
    } catch {
      setShareStatus("error");
    }
  }

  async function handleCopyClick() {
    if (!shareUrl) {
      return;
    }
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      flashCopiedFeedback();
    }
  }

  async function handleNativeShare() {
    if (!shareUrl || !canNativeShare) {
      return;
    }
    try {
      await navigator.share({
        title: `${data.emoji} ${data.result_type}`,
        text: `내 프론트엔드 진단 결과: ${data.result_type} (${data.total_correct}/${data.total})`,
        url: shareUrl,
      });
    } catch (err) {
      // AbortError는 DOMException이라 환경에 따라 `instanceof Error`가 false일
      // 수 있고, err가 null/undefined로 들어오는 경우도 있다 — 양쪽 다 안전하게.
      if (
        typeof err === "object" &&
        err !== null &&
        (err as { name?: unknown }).name === "AbortError"
      ) {
        return;
      }
      const ok = await copyToClipboard(shareUrl);
      if (ok) {
        flashCopiedFeedback();
      }
    }
  }

  useEffect(() => {
    // Reset on every dep change so a new round (different `data`) gets a
    // fresh stream instead of accumulating on top of the previous one. The
    // `ignore` flag guards against StrictMode double-invoke + late updates
    // from a stale effect. Share state도 함께 reset — 안 하면 새 라운드
    // 결과 페이지에서 이전 라운드의 공유 패널/URL이 그대로 남아 다시 공유를
    // 만들 수 없게 된다.
    setFeedback("");
    setFeedbackStatus("loading");
    setShareStatus("idle");
    setShareUrl(null);
    setCopyStatus("idle");
    if (copyResetRef.current) {
      clearTimeout(copyResetRef.current);
      copyResetRef.current = null;
    }
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
          if (!ignore) {
            setFeedbackStatus("unavailable");
          }
          return;
        }
        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }
        if (!ignore) {
          setFeedbackStatus("streaming");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done || ignore) {
            break;
          }
          setFeedback((prev) => prev + decoder.decode(value, { stream: true }));
        }
        // Flush any byte sequence that was held back on a UTF-8 boundary —
        // Korean characters are 3 bytes, easy to bisect across chunks.
        if (!ignore) {
          const tail = decoder.decode();
          if (tail) {
            setFeedback((prev) => prev + tail);
          }
          setFeedbackStatus("done");
        }
      } catch (err) {
        if (ignore || (err as { name?: string }).name === "AbortError") {
          return;
        }
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
        <p className="mb-2 text-sm font-medium tracking-wide text-rose-500">
          오늘의 진단
        </p>
        <h1 className="mb-2 text-4xl leading-tight font-bold tracking-tight">
          <span className="mr-2">{data.emoji}</span>
          {data.result_type}
        </h1>
        <p className="mb-3">
          <span className="inline-block rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold tracking-wider text-zinc-700 tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {data.type_code}
          </span>
          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
            {data.personality === "balanced" ? "균형형" : "편식형"}
          </span>
        </p>
        <p className="mb-2 text-base text-zinc-600 dark:text-zinc-300">
          {data.blurb}
        </p>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="mr-1">{data.vibe.emoji}</span>
          {data.vibe.blurb}
        </p>
        <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
          {data.total_correct}{" "}
          <span className="text-zinc-400 dark:text-zinc-600">/</span>{" "}
          {data.total}
          <span className="ml-2 text-base font-medium text-zinc-500 dark:text-zinc-400">
            ({overallPct}%)
          </span>
        </p>
      </section>

      <section className="mb-8 rounded-2xl border border-rose-100 bg-rose-50/40 p-5 dark:border-rose-900/30 dark:bg-rose-500/5">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-rose-500 uppercase">
          <span>친구의 한마디</span>
          {feedbackStatus === "loading" && (
            <span className="animate-pulse text-zinc-400 normal-case dark:text-zinc-500">
              생각 중…
            </span>
          )}
          {feedbackStatus === "streaming" && (
            <span className="animate-pulse text-zinc-400 normal-case dark:text-zinc-500">
              타이핑 중…
            </span>
          )}
        </div>
        {feedbackStatus === "error" && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            앗 친구가 잠깐 자리 비웠어. 새로고침하면 다시 와줄지도 🤞
          </p>
        )}
        {feedbackStatus === "unavailable" &&
          (process.env.NODE_ENV === "development" ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              (개발자에게:{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                ANTHROPIC_API_KEY
              </code>
              를
              <code className="ml-1 rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                .env.local
              </code>
              에 넣으면 친구가 깨어나요)
            </p>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              앗 친구가 잠깐 자리 비웠어. 새로고침하면 다시 와줄지도 🤞
            </p>
          ))}
        {feedback && (
          <p className="whitespace-pre-line text-base leading-relaxed text-zinc-800 dark:text-zinc-100">
            {feedback}
            {feedbackStatus === "streaming" && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-rose-400 align-middle" />
            )}
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          카테고리별
        </h2>
        <ul className="flex flex-col gap-3">
          {(
            Object.entries(data.category_scores) as [
              Category,
              { correct: number; total: number },
            ][]
          ).map(([cat, score]) => {
            const pct =
              score.total === 0
                ? 0
                : Math.round((score.correct / score.total) * 100);
            const isStrong = data.strengths.includes(cat);
            const isWeak = data.weaknesses.includes(cat);
            return (
              <li key={cat} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {CATEGORY_DISPLAY_LABEL[cat]}
                </span>
                <div className="flex-1 overflow-hidden rounded-full bg-zinc-200 h-2 dark:bg-zinc-800">
                  <div
                    className={`h-full transition-all ${isStrong ? "bg-emerald-500" : isWeak ? "bg-rose-500" : "bg-amber-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
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
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {open ? "▾" : "▸"} 문제 다시 보기
        </button>
        {open && (
          <ol id="result-questions" className="flex flex-col gap-4">
            {data.per_question.map((q, i) => (
              <li
                key={q.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  <span>
                    {i + 1}. {q.category}
                  </span>
                  <span
                    className={
                      q.is_correct
                        ? "font-semibold text-emerald-600 dark:text-emerald-400"
                        : "font-semibold text-rose-500"
                    }
                  >
                    {q.is_correct ? "정답" : "오답"}
                  </span>
                </div>
                {q.question_html ? (
                  <p
                    className="mb-3 text-base leading-relaxed text-zinc-900 dark:text-zinc-50"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered by `renderQuizMarkdown` from our own YAML seed (no user input); only inline-code spans, <strong>, and HTML-escaped <pre><code> from fenced blocks are injected.
                    dangerouslySetInnerHTML={{ __html: q.question_html }}
                  />
                ) : (
                  <p className="mb-3 text-base leading-relaxed text-zinc-900 dark:text-zinc-50">
                    {q.question}
                  </p>
                )}
                <CodeBlock
                  code={q.code}
                  codeHtml={q.code_html}
                  size="xs"
                  className="mb-3"
                />

                <ul className="mb-3 flex flex-col gap-1.5 text-sm">
                  {q.choices.map((choice) => {
                    const isCorrect = matches(q.correct_answer, choice.id);
                    const isYours = matches(q.your_answer, choice.id);
                    return (
                      <li
                        key={`${q.id}::${choice.id}`}
                        className={`rounded-lg border px-3 py-2 ${
                          isCorrect
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-100"
                            : isYours
                              ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-500/10 dark:text-rose-100"
                              : "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        <span className="mr-2">
                          {isCorrect ? "✓" : isYours ? "✗" : "·"}
                        </span>
                        {choice.text_html ? (
                          <span
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered by `renderQuizMarkdown` from our own YAML seed (no user input); only inline-code spans, <strong>, and HTML-escaped <pre><code> from fenced blocks are injected.
                            dangerouslySetInnerHTML={{
                              __html: choice.text_html,
                            }}
                          />
                        ) : (
                          <span>{choice.text}</span>
                        )}
                        {isYours && !isCorrect && (
                          <span className="ml-2 text-xs text-rose-500">
                            (내 답)
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {q.explanation_html ? (
                  <div
                    className="whitespace-pre-line rounded-xl bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered by `renderQuizMarkdown` from our own YAML seed (no user input); only inline-code spans, <strong>, and HTML-escaped <pre><code> from fenced blocks are injected.
                    dangerouslySetInnerHTML={{ __html: q.explanation_html }}
                  />
                ) : (
                  <p className="whitespace-pre-line rounded-xl bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    {q.explanation}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-auto flex flex-col gap-2">
        {shareStatus === "ready" && shareUrl ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold tracking-wider uppercase">
              <span
                className={
                  copyStatus === "copied"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-500 dark:text-zinc-400"
                }
              >
                {copyStatus === "copied"
                  ? "복사됐어! 친구한테 붙여넣어 봐"
                  : "공유 링크"}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:ring-zinc-600"
                aria-label="공유 링크"
              />
              {canNativeShare && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-800 active:scale-[0.97] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  aria-label="공유하기"
                  title="공유하기"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyClick}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.97] dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                aria-label="링크 복사"
                title="링크 복사"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
              </button>
            </div>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start text-xs text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              친구가 보는 화면 미리보기 ↗
            </a>
            <span className="sr-only" aria-live="polite">
              {copyStatus === "copied" ? "링크가 복사됐어요" : ""}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleShare}
            disabled={!canShare || shareStatus === "creating"}
            className="inline-flex h-14 w-full items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-zinc-800 enabled:active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-900 dark:enabled:hover:bg-zinc-200"
          >
            {shareStatus === "creating"
              ? "공유 만드는 중…"
              : !canShare
                ? "친구의 한마디 기다리는 중…"
                : "친구한테 보내기 →"}
          </button>
        )}
        {shareStatus === "error" && (
          <p className="text-center text-sm text-rose-500">
            공유 만들기에 실패했어. 잠시 후 다시 눌러봐.
          </p>
        )}
        <ContributeNote />
      </div>
    </main>
  );
}
