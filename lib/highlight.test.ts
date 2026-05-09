import { describe, expect, it, vi } from "vitest";

// Stub Shiki for the inline tests so they don't pay the WASM cold start.
// Each test that needs to assert on fenced output sets its own mock instead.
vi.mock("shiki/core", () => ({
  createHighlighterCore: async () => ({
    codeToHtml: (code: string, opts: { lang: string }) =>
      `<pre><code data-lang="${opts.lang}">${code}</code></pre>`,
  }),
}));
vi.mock("shiki/engine/oniguruma", () => ({
  createOnigurumaEngine: async () => ({}),
}));

import { renderQuizMarkdown } from "./highlight";

describe("renderQuizMarkdown — inline pass", () => {
  it("HTML-escapes plain text", async () => {
    expect(await renderQuizMarkdown("a < b & c > d", "javascript")).toBe("a &lt; b &amp; c &gt; d");
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
    expect(await renderQuizMarkdown("`<button>`을 써야 하는 이유로 **맞는 것**을", "html")).toBe(
      '<code class="inline-code">&lt;button&gt;</code>을 써야 하는 이유로 <strong>맞는 것</strong>을',
    );
  });

  it("does not bold-format inside backtick code", async () => {
    expect(await renderQuizMarkdown("`**not bold**` outside", "javascript")).toBe(
      '<code class="inline-code">**not bold**</code> outside',
    );
  });

  it("does not match bold across newlines", async () => {
    expect(await renderQuizMarkdown("**a\nb**", "javascript")).toBe("**a\nb**");
  });

  it("leaves stray asterisks alone", async () => {
    expect(await renderQuizMarkdown("a * b ** c", "javascript")).toBe("a * b ** c");
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
    expect(await renderQuizMarkdown("**a** rest", "javascript")).toBe("<strong>a</strong> rest");
  });
});

describe("renderQuizMarkdown — fenced blocks", () => {
  it("highlights fenced ```js blocks with the tagged language", async () => {
    const html = await renderQuizMarkdown("intro\n```js\nconst x = 1\n```\nouttro", "javascript");
    expect(html).toContain('data-lang="javascript"');
    expect(html).toContain("const x = 1");
    expect(html).toMatch(/^intro\n<div class="quiz-code-block /);
    expect(html).toMatch(/<\/div>\nouttro$/);
  });

  it("falls back to category lang when info-string is missing", async () => {
    const html = await renderQuizMarkdown("```\n.box { color: red }\n```", "css");
    expect(html).toContain('data-lang="css"');
  });

  it("falls back to category lang when info-string is unknown", async () => {
    const html = await renderQuizMarkdown("```rust\nfn main() {}\n```", "javascript");
    expect(html).toContain('data-lang="javascript"');
    // Shiki gets called with the *fallback* lang, not the unknown info-string.
    expect(html).toContain("fn main() {}");
  });

  it("renders multiple fences and preserves surrounding inline markup", async () => {
    const html = await renderQuizMarkdown(
      "before **strong**\n```js\nlet a\n```\nmiddle `code`\n```ts\nlet b\n```\nafter",
      "javascript",
    );
    expect(html).toContain("<strong>strong</strong>");
    expect(html).toContain('data-lang="javascript"');
    expect(html).toContain('data-lang="typescript"');
    expect(html).toContain('<code class="inline-code">code</code>');
  });

  it("does not bold-format inside fenced code", async () => {
    const html = await renderQuizMarkdown("```js\n// **not bold**\n```", "javascript");
    expect(html).toContain("// **not bold**");
    expect(html).not.toContain("<strong>");
  });

  it("treats an unclosed triple-backtick as literal text", async () => {
    expect(await renderQuizMarkdown("```js\nconst x = 1", "javascript")).toBe("```js\nconst x = 1");
  });
});
