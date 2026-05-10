import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lintQuestionProse } from "./lint-question-prose";

let root: string;

function writeQuestion(category: string, name: string, body: string): void {
  const dir = join(root, category);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), body, "utf8");
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lint-prose-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("lintQuestionProse", () => {
  it("flags a multi-line function body in choices[].text", () => {
    writeQuestion(
      "typescript",
      "01-fn.yaml",
      [
        "id: ts-001",
        "choices:",
        "  - id: a",
        "    text: |",
        "      function area(shape) {",
        "        return shape.r * 2",
        "      }",
        "",
      ].join("\n"),
    );

    const hits = lintQuestionProse(root);
    expect(hits.length).toBe(1);
    expect(hits[0].field).toBe("text");
    expect(hits[0].reason).toMatch(/function|return/);
  });

  it("flags arrow function in inline text", () => {
    writeQuestion(
      "typescript",
      "02-arrow.yaml",
      [
        "id: ts-002",
        "choices:",
        "  - id: a",
        '    text: "xs.map(x => x * 2)"',
        "",
      ].join("\n"),
    );
    const hits = lintQuestionProse(root);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("does not flag text already wrapped in inline backticks", () => {
    writeQuestion(
      "typescript",
      "03-wrapped.yaml",
      [
        "id: ts-003",
        "choices:",
        "  - id: a",
        '    text: "`xs.map(x => x * 2)`"',
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root)).toEqual([]);
  });

  it("does not flag fenced code blocks", () => {
    writeQuestion(
      "typescript",
      "04-fenced.yaml",
      [
        "id: ts-004",
        "choices:",
        "  - id: a",
        "    text: |",
        "      ```ts",
        "      function area(shape) {",
        "        return shape.r * 2",
        "      }",
        "      ```",
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root)).toEqual([]);
  });

  it("honors `# fmt: off-prose` above the choice item (covers `- id:` + `text:`)", () => {
    // Without the marker, `xs.push(4)` triggers the method-call heuristic.
    // With the marker placed above the list-item header, the linter must
    // walk past `- id: a` to find it.
    const body = (withMarker: boolean) =>
      [
        "id: ts-005",
        "choices:",
        ...(withMarker ? ["  # fmt: off-prose"] : []),
        "  - id: a",
        '    text: "xs.push(4) 동작에 대한 산문 설명이지만 코드 토큰을 포함"',
        "",
      ].join("\n");

    writeQuestion("typescript", "05-no-marker.yaml", body(false));
    expect(lintQuestionProse(root).length).toBe(1);

    rmSync(root, { recursive: true, force: true });
    root = mkdtempSync(join(tmpdir(), "lint-prose-"));
    writeQuestion("typescript", "05-with-marker.yaml", body(true));
    expect(lintQuestionProse(root)).toEqual([]);
  });

  it("honors `# fmt: off-prose` directly above the field key", () => {
    writeQuestion(
      "typescript",
      "05b-key-marker.yaml",
      [
        "id: ts-005b",
        "choices:",
        "  - id: a",
        "    # fmt: off-prose",
        '    text: "xs.map(x => x * 2)는 산문 안에서 나오는 코드 토큰"',
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root)).toEqual([]);
  });

  it("honors `# fmt: off-prose` for a block-scalar field", () => {
    writeQuestion(
      "typescript",
      "05c-block-marker.yaml",
      [
        "id: ts-005c",
        "choices:",
        "  - id: a",
        "    # fmt: off-prose",
        "    text: |",
        "      여러 줄에 걸친 산문이지만 그 안에 xs.push(4) 같은 코드 토큰이 등장",
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root)).toEqual([]);
  });

  it("flags bare type-keyword answers like 'any' / 'never'", () => {
    writeQuestion(
      "typescript",
      "06-typekw.yaml",
      [
        "id: ts-006",
        "choices:",
        "  - id: a",
        '    text: "any"',
        "  - id: b",
        '    text: "never"',
        "",
      ].join("\n"),
    );
    const hits = lintQuestionProse(root);
    expect(hits.map((h) => h.line).sort()).toEqual([4, 6]);
  });

  it("flags bare type-literal answers like { id: number }", () => {
    writeQuestion(
      "typescript",
      "07-typelit.yaml",
      [
        "id: ts-007",
        "choices:",
        "  - id: a",
        '    text: "{ id: number; name: string }"',
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root).length).toBe(1);
  });

  it("flags array literal answers like [2, 4, 6, 8]", () => {
    writeQuestion(
      "javascript",
      "08-arr.yaml",
      [
        "id: js-008",
        "choices:",
        "  - id: a",
        '    text: "[2, 4, 6, 8]"',
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root).length).toBe(1);
  });

  it("flags CSS shorthand answers", () => {
    writeQuestion(
      "css",
      "09-css.yaml",
      [
        "id: css-009",
        "choices:",
        "  - id: a",
        '    text: "flex-grow: 1; flex-shrink: 1; flex-basis: 0%"',
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root).length).toBe(1);
  });

  it("flags HTML element-name answers", () => {
    writeQuestion(
      "html",
      "10-html.yaml",
      ["id: html-010", "choices:", "  - id: a", '    text: "<main>"', ""].join(
        "\n",
      ),
    );
    expect(lintQuestionProse(root).length).toBe(1);
  });

  it("does NOT flag Korean prose containing parenthetical asides", () => {
    writeQuestion(
      "react",
      "11-prose.yaml",
      [
        "id: react-011",
        "choices:",
        "  - id: a",
        '    text: "React 컴포넌트 트리(이벤트 버블링, context)는 그대로 부모를 따른다"',
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root)).toEqual([]);
  });

  it("does NOT flag Korean prose mentioning code-related concepts", () => {
    writeQuestion(
      "react",
      "12-prose.yaml",
      [
        "id: react-012",
        "question: |",
        "  useEffect의 cleanup 함수는 언제 실행돼?",
        "explanation: |",
        "  paint 이후 비동기적으로 실행돼서 다음 렌더 직전에 정리된다.",
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root)).toEqual([]);
  });

  it("flags raw JSX in explanation when not wrapped", () => {
    writeQuestion(
      "react",
      "13-jsx.yaml",
      [
        "id: react-013",
        "explanation: |",
        "  <Provider value={1}><Child /></Provider> 형태로 감싸야 한다.",
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root).length).toBe(1);
  });

  it("strips backtick spans before checking — partially-wrapped prose passes", () => {
    writeQuestion(
      "typescript",
      "14-partial.yaml",
      [
        "id: ts-014",
        "explanation: |",
        "  `as`는 단언이라 검사를 하지 않는다.",
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root)).toEqual([]);
  });

  it("does NOT flag Korean prose that uses => as 'implies/then'", () => {
    writeQuestion(
      "react",
      "15-arrow-prose.yaml",
      [
        "id: react-015",
        "explanation: |",
        "  버튼 클릭 => 모달 열림 => 본문 스크롤 잠금이 순서대로 일어난다.",
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root)).toEqual([]);
  });

  it("flags real arrow functions (parens or single ident before =>)", () => {
    writeQuestion(
      "javascript",
      "16-arrow-fn.yaml",
      [
        "id: js-016",
        "choices:",
        "  - id: a",
        '    text: "x => x * 2"',
        "  - id: b",
        '    text: "(props, ref) => null"',
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root).length).toBe(2);
  });

  it("does NOT flag English abbreviations like 'e.g. (...)' or 'i.e. (...)'", () => {
    writeQuestion(
      "react",
      "17-abbrev.yaml",
      [
        "id: react-017",
        "explanation: |",
        "  드물게 e.g. (legacy refs) 같은 패턴이 나온다. i.e. (older code)에서.",
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root)).toEqual([]);
  });

  it("does NOT flag a Korean note ending with semicolon", () => {
    writeQuestion(
      "css",
      "18-note.yaml",
      [
        "id: css-018",
        "explanation: |",
        "  note: 이건 CSS 룰이 아니라 일반 메모일 뿐;",
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root)).toEqual([]);
  });

  it("flags multi-declaration CSS shorthand answers", () => {
    writeQuestion(
      "css",
      "19-css-multi.yaml",
      [
        "id: css-019",
        "choices:",
        "  - id: a",
        '    text: "flex-grow: 1; flex-shrink: 1; flex-basis: 0%"',
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root).length).toBe(1);
  });

  it("ignores a trailing YAML comment after a value", () => {
    writeQuestion(
      "typescript",
      "20-trailing-comment.yaml",
      [
        "id: ts-020",
        "choices:",
        "  - id: a",
        '    text: "`useState`" # 정답',
        "",
      ].join("\n"),
    );
    expect(lintQuestionProse(root)).toEqual([]);
  });
});
