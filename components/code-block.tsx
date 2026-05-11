"use client";

import { useState } from "react";

type Size = "sm" | "xs";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "rounded-2xl p-4 text-sm",
  xs: "rounded-xl p-3 text-xs",
};

export function CodeBlock({
  code,
  codeHtml,
  size = "sm",
  className = "",
}: {
  code?: string;
  codeHtml?: string;
  size?: Size;
  className?: string;
}) {
  const [wrap, setWrap] = useState(true);

  if (!code && !codeHtml) {
    return null;
  }

  const wrapClass = wrap
    ? "whitespace-pre-wrap break-words [&_pre]:whitespace-pre-wrap [&_pre]:break-words"
    : "[&_pre]:overflow-x-auto [&_pre]:whitespace-pre [&_.quiz-code-block]:overflow-x-auto [&_.quiz-code-block]:whitespace-pre";

  return (
    <div
      className={`relative bg-zinc-900 font-mono leading-relaxed text-zinc-100 ${SIZE_CLASSES[size]} ${wrapClass} ${className}`}
    >
      <button
        type="button"
        onClick={() => setWrap((v) => !v)}
        aria-pressed={wrap}
        aria-label={wrap ? "가로 스크롤로 전환" : "줄바꿈으로 전환"}
        title={
          wrap
            ? "긴 줄을 줄바꿈 중. 클릭하면 가로 스크롤로 전환합니다."
            : "가로 스크롤 중. 클릭하면 줄바꿈으로 전환합니다."
        }
        className="absolute top-1.5 right-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800/90 text-zinc-300 backdrop-blur-sm hover:bg-zinc-700 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
      >
        {wrap ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M3 12h15a3 3 0 0 1 0 6h-4" />
            <path d="m16 16-2 2 2 2" />
            <path d="M3 18h7" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8l4 4-4 4" />
            <path d="M6 8l-4 4 4 4" />
            <path d="M2 12h20" />
          </svg>
        )}
      </button>
      {codeHtml ? (
        <div
          className="quiz-code-block pr-8"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: `highlightCode` output (HTML-escaped <pre><code>) from our own YAML seed; no user input.
          dangerouslySetInnerHTML={{ __html: codeHtml }}
        />
      ) : (
        <pre className="pr-8">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
