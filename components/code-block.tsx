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
    : "overflow-x-auto [&_pre]:overflow-x-auto";

  return (
    <div
      className={`relative bg-zinc-900 font-mono leading-relaxed text-zinc-100 ${SIZE_CLASSES[size]} ${wrapClass} ${className}`}
    >
      <button
        type="button"
        onClick={() => setWrap((v) => !v)}
        aria-pressed={wrap}
        title={
          wrap
            ? "긴 줄을 줄바꿈 중. 클릭하면 가로 스크롤로 전환합니다."
            : "가로 스크롤 중. 클릭하면 줄바꿈으로 전환합니다."
        }
        className="absolute top-2 right-2 z-10 rounded-md bg-zinc-800/90 px-2 py-1 text-[10px] font-medium text-zinc-300 backdrop-blur-sm hover:bg-zinc-700 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
      >
        {wrap ? "줄바꿈" : "스크롤"}
      </button>
      {codeHtml ? (
        <div
          className="quiz-code-block pr-12"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: `highlightCode` output (HTML-escaped <pre><code>) from our own YAML seed; no user input.
          dangerouslySetInnerHTML={{ __html: codeHtml }}
        />
      ) : (
        <pre className="pr-12">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
