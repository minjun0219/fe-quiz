import { useState } from "react";

type Size = "sm" | "xs";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "rounded-xl p-4 text-[13px]",
  xs: "rounded-lg p-3 text-xs",
};

export function CodeBlock({
  code,
  highlightedCodeHtml,
  size = "sm",
  className = "",
}: {
  /** Plain code string; rendered as `<pre><code>{code}</code></pre>`. */
  code?: string;
  /**
   * Pre-rendered code HTML, expected to be exactly the shape produced by
   * `highlightCode` in `lib/highlight.ts` (HTML-escaped `<pre><code>…</code></pre>`
   * from the server-only YAML seed pipeline). Injected as-is via
   * `dangerouslySetInnerHTML` — NEVER pass user-derived or external HTML.
   */
  highlightedCodeHtml?: string;
  size?: Size;
  className?: string;
}) {
  const [wrap, setWrap] = useState(true);

  if (!code && !highlightedCodeHtml) {
    return null;
  }

  // 코드를 감싸는 시각적 박스(rounded + ring + bg + padding)와 스크롤이 같은
  // 컨테이너에서 발생. 스크롤바는 박스의 둥근 경계 안 하단에 들어와 한 덩어리로 보임.
  // 토글 버튼은 스크롤되지 않는 외곽 relative 래퍼에 두어 위치 고정.
  const modeClasses = wrap
    ? "whitespace-pre-wrap break-words [&_pre]:whitespace-pre-wrap [&_pre]:break-words"
    : "overflow-x-auto whitespace-pre [&_pre]:whitespace-pre";

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
      <div
        className={`bg-zinc-900 font-mono leading-relaxed text-zinc-100 ring-1 ring-inset ring-white/5 ${SIZE_CLASSES[size]} ${modeClasses}`}
      >
        {highlightedCodeHtml ? (
          <div
            className="quiz-code-block pr-8"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: prop is contracted to be `highlightCode` output (HTML-escaped <pre><code>) from server-only `lib/highlight.ts` — see `highlightedCodeHtml` JSDoc.
            dangerouslySetInnerHTML={{ __html: highlightedCodeHtml }}
          />
        ) : (
          <pre className="pr-8">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
