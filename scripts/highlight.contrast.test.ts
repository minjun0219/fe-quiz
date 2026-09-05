import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 코드 하이라이팅 토큰 색이 코드 블록 배경 위에서 WCAG AA(4.5:1)를 지키는지.
 *
 * 눈으로는 회귀를 못 잡는다 — "좀 흐린데?" 와 "AA 미달" 은 화면에서 구분이
 * 안 된다. 실제로 주석 색을 "물러나게" 하려다 4.17:1까지 내려간 적이 있고,
 * 하필 `// (1)` 처럼 답을 가리키는 표식이 주석으로 들어가는 문항이 있어
 * 저시력 사용자가 문제 자체를 못 푸는 상태였다.
 *
 * CSS 값을 파일에서 직접 읽는다. 상수를 TS로 복사하면 둘이 어긋나는 순간
 * 테스트가 거짓 통과한다 — 지켜야 할 대상은 브라우저가 실제로 쓰는 값이다.
 */

// `components/code-block.tsx`와 `FENCE_WRAPPER_CLASS`가 쓰는 Tailwind
// `bg-zinc-900`. 라이트/다크 분기가 없어 이 값 하나만 상대하면 된다.
const CODE_BG: RGB = [24, 24, 27];

type RGB = [number, number, number];

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: RGB): number {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** `--tok-x: rgb(1 2 3);` 선언을 전부 걷어 온다. */
function readTokenColors(): Record<string, RGB> {
  const css = readFileSync("app/app.css", "utf8");
  const out: Record<string, RGB> = {};
  for (const m of css.matchAll(
    /--(tok-[\w-]+):\s*rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)/g,
  )) {
    out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return out;
}

describe("코드 하이라이팅 대비", () => {
  const colors = readTokenColors();

  it("토큰 색 변수를 실제로 찾는다 (셀렉터가 바뀌면 여기서 먼저 깨진다)", () => {
    expect(Object.keys(colors).sort()).toEqual([
      "tok-comment",
      "tok-keyword",
      "tok-number",
      "tok-string",
    ]);
  });

  for (const [name, rgb] of Object.entries(colors)) {
    it(`${name}이 zinc-900 위에서 AA(4.5:1) 이상`, () => {
      expect(contrastRatio(rgb, CODE_BG)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("주석은 여전히 본문보다 눌려 있다 (물러나게 하려던 의도)", () => {
    // zinc-100 = 본문 색. 주석이 이보다 밝아지면 "물러남"이 사라진다.
    const body: RGB = [244, 244, 245];
    expect(contrastRatio(colors["tok-comment"], CODE_BG)).toBeLessThan(
      contrastRatio(body, CODE_BG),
    );
  });
});
