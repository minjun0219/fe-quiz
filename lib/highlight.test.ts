import { describe, expect, it } from "vitest";
import { highlightCode, renderQuizMarkdown } from "./highlight";

/**
 * 출력에서 태그를 걷고 엔티티를 풀면 입력과 정확히 같아야 한다.
 *
 * 이게 이 모듈의 안전 성질이다 — 토크나이저가 오탐해도(정규식 안의 따옴표 등)
 * 색만 틀리지 코드 한 글자도 바뀌거나 사라지면 안 된다.
 */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

describe("highlightCode — 최소 팔레트 (#30)", () => {
  it("HTML을 이스케이프하고 <pre><code>로 감싼다", async () => {
    expect(await highlightCode("<div>{x && y}</div>", "javascript")).toBe(
      "<pre><code>&lt;div&gt;{x &amp;&amp; y}&lt;/div&gt;</code></pre>",
    );
  });

  it("공백을 그대로 보존한다", async () => {
    expect(await highlightCode("  a\n  b", "javascript")).toBe(
      "<pre><code>  a\n  b</code></pre>",
    );
  });

  it("줄 주석과 블록 주석을 tok-c로", async () => {
    const out = await highlightCode("// hi\nlet a = 1; /* b */", "javascript");
    expect(out).toContain('<span class="tok-c">// hi</span>');
    expect(out).toContain('<span class="tok-c">/* b */</span>');
  });

  it("따옴표 세 종류를 tok-s로", async () => {
    const out = await highlightCode("a='x'; b=\"y\"; c=`z`;", "javascript");
    expect(out).toContain(`<span class="tok-s">&#39;x&#39;</span>`);
    expect(out).toContain(`<span class="tok-s">&quot;y&quot;</span>`);
    expect(out).toContain('<span class="tok-s">`z`</span>');
  });

  it("이스케이프된 따옴표는 문자열을 안 닫는다", async () => {
    const out = await highlightCode(`a = "x\\"y";`, "javascript");
    expect(textOf(out)).toBe(`a = "x\\"y";`);
    expect(out.match(/tok-s/g)?.length).toBe(1);
  });

  it("닫히지 않은 따옴표는 평문으로 되돌린다 — 뒤를 삼키면 안 된다", async () => {
    const out = await highlightCode(
      `const re = /["']/;\nconst s = 1;`,
      "javascript",
    );
    expect(textOf(out)).toBe(`const re = /["']/;\nconst s = 1;`);
  });

  it("CSS는 // 를 주석으로 보지 않는다 (블록 주석만)", async () => {
    const out = await highlightCode("a { background: url(//x) }", "css");
    expect(out).not.toContain("tok-c");
    expect(await highlightCode("/* c */", "css")).toContain('class="tok-c"');
  });

  it("HTML은 <!-- --> 주석과 태그 안 속성만 칠한다", async () => {
    const out = await highlightCode(`<!-- c --><a href="x">don't</a>`, "html");
    expect(out).toContain('<span class="tok-c">&lt;!-- c --&gt;</span>');
    expect(out).toContain('<span class="tok-s">&quot;x&quot;</span>');
    // 본문의 아포스트로피가 문자열을 열어 뒤를 삼키면 안 된다.
    expect(textOf(out)).toBe(`<!-- c --><a href="x">don't</a>`);
  });

  it("JS 키워드와 숫자를 칠한다", async () => {
    const out = await highlightCode("const a = 42;", "javascript");
    expect(out).toContain('<span class="tok-k">const</span>');
    expect(out).toContain('<span class="tok-n">42</span>');
  });

  it("식별자 안의 부분 문자열을 키워드로 잡지 않는다", async () => {
    const out = await highlightCode("constant = iffy + newness;", "javascript");
    expect(out).not.toContain("tok-k");
  });

  it("식별자·함수명은 칠하지 않는다 (다이어트 유지)", async () => {
    const out = await highlightCode("foo(bar, baz)", "javascript");
    expect(out).not.toContain("tok-k");
    expect(out).not.toContain("tok-n");
  });

  it("CSS는 블록 안 속성명과 @규칙만 — 선택자의 :hover는 아니다", async () => {
    const out = await highlightCode(
      "@media (min-width: 40rem) { a:hover { color: red } }",
      "css",
    );
    expect(out).toContain('<span class="tok-k">@media</span>');
    expect(out).toContain('<span class="tok-k">color</span>');
    // `a:hover`의 `a`는 선택자다 — 깊이 0이라 안 칠해진다.
    expect(out).not.toContain('<span class="tok-k">a</span>');
  });

  it("HTML 주석은 언어를 안 가린다 (한 블록에 HTML+CSS가 섞인 문항)", async () => {
    const mixed = "/* CSS */\n.a { color: red }\n\n<!-- HTML -->\n<p>x</p>";
    const out = await highlightCode(mixed, "css");
    expect(out).toContain('<span class="tok-c">/* CSS */</span>');
    expect(out).toContain('<span class="tok-c">&lt;!-- HTML --&gt;</span>');
    expect(textOf(out)).toBe(mixed);
  });

  it("HTML은 태그명을 칠한다", async () => {
    const out = await highlightCode("<div><br/></div>", "html");
    expect(out).toContain('<span class="tok-k">div</span>');
    expect(out).toContain('<span class="tok-k">/div</span>');
  });

  it("무엇을 넣어도 텍스트가 보존된다 (왕복 성질)", async () => {
    const samples = [
      "const a = 'x';",
      "// c\nlet b = `t${x}`;",
      "/* 안 닫힌 주석",
      `"unterminated`,
      "a{b:'c'}",
      `<p class='q'>x</p>`,
      "```\nnested?\n```",
      "&<>\"'",
      "const a = 0x1f + 1_000n;",
      "@media(x){y:1px}",
      "<a b='c'>d</a>",
      "",
    ];
    for (const src of samples) {
      for (const cat of ["javascript", "css", "html"] as const) {
        expect(textOf(await highlightCode(src, cat))).toBe(src);
      }
    }
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
    expect(html).toContain("<pre><code>");
    expect(textOf(html)).toContain("const x = 1");
    expect(html).toMatch(/<\/div>\nouttro$/);
  });

  it("escapes HTML inside fenced code", async () => {
    const html = await renderQuizMarkdown("```html\n<div>&</div>\n```", "html");
    // 태그명은 칠해지고 나머지는 이스케이프된다.
    expect(html).toContain('<span class="tok-k">div</span>');
    expect(textOf(html)).toContain("<div>&</div>");
  });

  it("모르는 info-string은 js로 떨어진다", async () => {
    const html = await renderQuizMarkdown(
      "```rust\nfn main() {}\n```",
      "javascript",
    );
    expect(textOf(html)).toContain("fn main() {}");
  });

  it("renders multiple fences and preserves surrounding inline markup", async () => {
    const html = await renderQuizMarkdown(
      "before **strong**\n```js\nlet a\n```\nmiddle `code`\n```ts\nlet b\n```\nafter",
      "javascript",
    );
    expect(html).toContain("<strong>strong</strong>");
    expect(textOf(html)).toContain("let a");
    expect(textOf(html)).toContain("let b");
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
