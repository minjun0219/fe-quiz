import type { ReactNode } from "react";

/**
 * Render a feedback string into React nodes, wrapping single-backtick runs
 * in <code class="inline-code">.
 *
 * Mirrors the single-line / single-backtick rules from `renderInlineSegment`
 * in `lib/highlight.ts` (which is server-only and runs HTML-escape itself),
 * but emits React children so it works from both client and server
 * components and lets React handle escaping. We only handle inline backticks
 * — the feedback prompt forbids any other markdown.
 *
 * Streaming-safe: when called on a partial string with an opener whose
 * closer hasn't arrived yet, the opener falls through as a literal backtick
 * and resolves into <code> once the closer is received on the next chunk.
 */
export function renderFeedbackInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const tick = text.indexOf("`", i);
    if (tick === -1) {
      nodes.push(text.slice(i));
      break;
    }
    if (tick > i) {
      nodes.push(text.slice(i, tick));
    }

    let runEnd = tick;
    while (runEnd < text.length && text[runEnd] === "`") {
      runEnd++;
    }
    const openLen = runEnd - tick;

    if (openLen !== 1) {
      nodes.push("`".repeat(openLen));
      i = runEnd;
      continue;
    }

    let scan = runEnd;
    let closeStart = -1;
    while (scan < text.length && text[scan] !== "\n") {
      if (text[scan] !== "`") {
        scan++;
        continue;
      }
      let k = scan;
      while (k < text.length && text[k] === "`") {
        k++;
      }
      if (k - scan === 1) {
        closeStart = scan;
        break;
      }
      scan = k;
    }

    if (closeStart === -1) {
      nodes.push("`");
      i = runEnd;
      continue;
    }

    nodes.push(
      <code key={`c${key++}`} className="inline-code">
        {text.slice(runEnd, closeStart)}
      </code>,
    );
    i = closeStart + 1;
  }
  return nodes;
}
