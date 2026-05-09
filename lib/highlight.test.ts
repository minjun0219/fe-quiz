import { describe, expect, it } from "vitest";
import { highlightCode, renderQuizMarkdown } from "./highlight";

describe("highlightCode (plain monospace, no Shiki — see #30)", () => {
  it("HTML-escapes the code and wraps in <pre><code>", async () => {
    expect(await highlightCode("<div>{x && y}</div>", "javascript")).toBe(
      "<pre><code>&lt;div&gt;{x &amp;&amp; y}&lt;/div&gt;</code></pre>",
    );
  });

  it("preserves whitespace verbatim", async () => {
    expect(await highlightCode("  a\n  b", "javascript")).toBe(
      "<pre><code>  a\n  b</code></pre>",
    );
  });
});

describe("renderQuizMarkdown — inline pass", () => {
  it("HTML-escapes plain text", async () => {
    expect(await renderQuizMarkdown("a < b & c > d", "javascript")).toBe(
      "a &lt; b &amp; c &gt; d",
    );
  });

  it("wraps single-backtick spans in inline-code and escapes inner text", async () => {
    expect(await renderQuizMarkdown("use `<div>` here", "javascript")).toBe(
      'use <code class="inline-code">&lt;div&gt;</code> here',
    );
  });

  it("wraps **bold** in <strong>", async () => {
    expect(await renderQuizMarkdown("**옳은 설명**은?", "javascript")).toBe(
      "<strong>옳은 설명</strong>은?",
    );
  });

  it("handles bold mixed with inline code", async () => {
    expect(
      await renderQuizMarkdown(
        "`<button>`을 써야 하는 이유로 **맞는 것**을",
        "html",
      ),
    ).toBe(
      '<code class="inline-code">&lt;button&gt;</code>을 써야 하는 이유로 <strong>맞는 것</strong>을',
    );
  });

  it("does not bold-format inside backtick code", async () => {
    expect(
      await renderQuizMarkdown("`**not bold**` outside", "javascript"),
    ).toBe('<code class="inline-code">**not bold**</code> outside');
  });

  it("does not match bold across newlines", async () => {
    expect(await renderQuizMarkdown("**a\nb**", "javascript")).toBe("**a\nb**");
  });

  it("leaves stray asterisks alone", async () => {
    expect(await renderQuizMarkdown("a * b ** c", "javascript")).toBe(
      "a * b ** c",
    );
    expect(await renderQuizMarkdown("****", "javascript")).toBe("****");
  });

  it("doesn't bold-wrap exponent operators with surrounding spaces", async () => {
    // TS option text from the shape-area question — the `**` are exponent
    // operators, not bold delimiters, so the inner spans must stay literal.
    const src = "return shape.r ? Math.PI * shape.r ** 2 : shape.s ** 2";
    expect(await renderQuizMarkdown(src, "typescript")).toBe(
      "return shape.r ? Math.PI * shape.r ** 2 : shape.s ** 2",
    );
  });

  it("matches single-character bold like **a**", async () => {
    expect(await renderQuizMarkdown("**a** rest", "javascript")).toBe(
      "<strong>a</strong> rest",
    );
  });
});

describe("renderQuizMarkdown — fenced blocks", () => {
  it("emits an escaped pre/code block wrapped in the dark code-block div", async () => {
    const html = await renderQuizMarkdown(
      "intro\n```js\nconst x = 1\n```\nouttro",
      "javascript",
    );
    expect(html).toMatch(/^intro\n<div class="quiz-code-block /);
    expect(html).toContain("<pre><code>const x = 1</code></pre>");
    expect(html).toMatch(/<\/div>\nouttro$/);
  });

  it("escapes HTML inside fenced code", async () => {
    const html = await renderQuizMarkdown("```html\n<div>&</div>\n```", "html");
    expect(html).toContain(
      "<pre><code>&lt;div&gt;&amp;&lt;/div&gt;</code></pre>",
    );
  });

  it("ignores info-string and language fallback (no highlighting in this build)", async () => {
    const html = await renderQuizMarkdown(
      "```rust\nfn main() {}\n```",
      "javascript",
    );
    expect(html).toContain("<pre><code>fn main() {}</code></pre>");
  });

  it("renders multiple fences and preserves surrounding inline markup", async () => {
    const html = await renderQuizMarkdown(
      "before **strong**\n```js\nlet a\n```\nmiddle `code`\n```ts\nlet b\n```\nafter",
      "javascript",
    );
    expect(html).toContain("<strong>strong</strong>");
    expect(html).toContain("<pre><code>let a</code></pre>");
    expect(html).toContain("<pre><code>let b</code></pre>");
    expect(html).toContain('<code class="inline-code">code</code>');
  });

  it("does not bold-format inside fenced code", async () => {
    const html = await renderQuizMarkdown(
      "```js\n// **not bold**\n```",
      "javascript",
    );
    expect(html).toContain("// **not bold**");
    expect(html).not.toContain("<strong>");
  });

  it("treats an unclosed triple-backtick as literal text", async () => {
    expect(await renderQuizMarkdown("```js\nconst x = 1", "javascript")).toBe(
      "```js\nconst x = 1",
    );
  });
});
