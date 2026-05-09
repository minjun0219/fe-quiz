import { describe, expect, it } from "vitest";
import { highlightInlineBackticks } from "./highlight";

describe("highlightInlineBackticks", () => {
  it("HTML-escapes plain text", () => {
    expect(highlightInlineBackticks("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
  });

  it("wraps single-backtick spans in inline-code and escapes inner text", () => {
    expect(highlightInlineBackticks("use `<div>` here")).toBe(
      'use <code class="inline-code">&lt;div&gt;</code> here',
    );
  });

  it("wraps **bold** in <strong>", () => {
    expect(highlightInlineBackticks("**옳은 설명**은?")).toBe("<strong>옳은 설명</strong>은?");
  });

  it("handles bold mixed with inline code", () => {
    expect(highlightInlineBackticks("`<button>`을 써야 하는 이유로 **맞는 것**을")).toBe(
      '<code class="inline-code">&lt;button&gt;</code>을 써야 하는 이유로 <strong>맞는 것</strong>을',
    );
  });

  it("does not bold-format inside backtick code", () => {
    expect(highlightInlineBackticks("`**not bold**` outside")).toBe(
      '<code class="inline-code">**not bold**</code> outside',
    );
  });

  it("does not match bold across newlines", () => {
    expect(highlightInlineBackticks("**a\nb**")).toBe("**a\nb**");
  });

  it("leaves stray asterisks alone", () => {
    expect(highlightInlineBackticks("a * b ** c")).toBe("a * b ** c");
    expect(highlightInlineBackticks("****")).toBe("****");
  });

  it("preserves multi-backtick fence openers", () => {
    expect(highlightInlineBackticks("```js\ncode\n```")).toBe("```js\ncode\n```");
  });
});
