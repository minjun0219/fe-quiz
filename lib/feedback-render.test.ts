import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderFeedbackInline } from "./feedback-render";

/**
 * Inspect a ReactNode[] without rendering — the helper returns a flat array
 * of strings and `<code>` React elements, so we can read `type` / `props`
 * directly. Keeps the test in the default node environment (vitest.config.ts).
 */
function shape(nodes: ReactNode[]): Array<string | { code: string }> {
  return nodes.map((n) => {
    if (typeof n === "string") {
      return n;
    }
    const el = n as ReactElement<{ children: string; className: string }>;
    expect(el.type).toBe("code");
    expect(el.props.className).toBe("inline-code");
    return { code: el.props.children };
  });
}

describe("renderFeedbackInline", () => {
  it("returns plain text untouched when no backticks", () => {
    expect(shape(renderFeedbackInline("그냥 평문이에요."))).toEqual([
      "그냥 평문이에요.",
    ]);
  });

  it("wraps a single-backtick span in <code>", () => {
    expect(shape(renderFeedbackInline("`display` 속성"))).toEqual([
      { code: "display" },
      " 속성",
    ]);
  });

  it("handles multiple inline spans on the same line", () => {
    expect(
      shape(renderFeedbackInline("`defer` 와 `async` 는 다릅니다.")),
    ).toEqual([
      { code: "defer" },
      " 와 ",
      { code: "async" },
      " 는 다릅니다.",
    ]);
  });

  it("treats an unclosed backtick as a literal", () => {
    expect(shape(renderFeedbackInline("끝나지 않은 `토큰"))).toEqual([
      "끝나지 않은 ",
      "`",
      "토큰",
    ]);
  });

  it("does not pair across a newline", () => {
    // The opener has no same-line closer — the next line's lone backtick is
    // *another* opener, also unmatched. Both stay literal.
    expect(shape(renderFeedbackInline("`open\nstill `closed`?"))).toEqual([
      "`",
      "open\nstill ",
      { code: "closed" },
      "?",
    ]);
  });

  it("preserves whitespace-pre-line newlines outside code spans", () => {
    expect(
      shape(renderFeedbackInline("첫 단락이에요.\n\n두 번째 단락은 `code` 포함.")),
    ).toEqual(["첫 단락이에요.\n\n두 번째 단락은 ", { code: "code" }, " 포함."]);
  });

  it("passes through ``...`` (multi-backtick runs) literally without pair-matching", () => {
    // No fenced-block support in the feedback path — multi-backtick runs are
    // emitted as-is so a stray `` doesn't get mangled into an empty <code>.
    expect(shape(renderFeedbackInline("이건 ``literal`` 그대로"))).toEqual([
      "이건 ",
      "``",
      "literal",
      "``",
      " 그대로",
    ]);
  });

  it("emits an empty array for an empty string", () => {
    expect(shape(renderFeedbackInline(""))).toEqual([]);
  });

  it("assigns stable keys to <code> elements", () => {
    const out = renderFeedbackInline("`a` and `b`");
    const codes = out.filter(
      (n): n is ReactElement => typeof n !== "string" && n !== null,
    );
    expect(codes).toHaveLength(2);
    expect(codes[0].key).not.toBe(codes[1].key);
  });
});
