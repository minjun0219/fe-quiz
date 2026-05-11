"use client";

import { useState } from "react";

type Size = "sm" | "xs";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "rounded-xl p-4 text-sm",
  xs: "rounded-lg p-3 text-xs",
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

  // 박스(패딩 포함)는 한 덩어리, 스크롤은 박스 바깥(중간 컨테이너)에서 발생.
  // - wrap 모드: 박스가 부모 너비를 채우고 긴 줄은 줄바꿈
  // - scroll 모드: 박스가 코드 내재 너비(w-max, 단 부모보다 작지는 않게)로 커지고,
  //   부모(middle)에 가로 스크롤이 생겨 박스 전체가 좌우로 이동. 스크롤바는 박스 아래.
  const boxClasses = wrap
    ? "w-full whitespace-pre-wrap break-words [&_pre]:whitespace-pre-wrap [&_pre]:break-words"
    : "w-max min-w-full whitespace-pre [&_pre]:whitespace-pre";

  return (
    <div className={`relative ${className}`}>
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
      <div className={wrap ? "" : "overflow-x-auto"}>
        <div
          className={`bg-zinc-900 font-mono leading-relaxed text-zinc-100 ring-1 ring-inset ring-white/5 ${SIZE_CLASSES[size]} ${boxClasses}`}
        >
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
      </div>
    </div>
  );
}
