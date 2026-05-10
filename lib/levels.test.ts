import { describe, expect, it } from "vitest";
import { DEFAULT_LEVEL, isLevel, toLevel } from "./levels";

describe("isLevel", () => {
  it("accepts the canonical level ids", () => {
    expect(isLevel("intro")).toBe(true);
    expect(isLevel("normal")).toBe(true);
    expect(isLevel("challenge")).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isLevel("expert")).toBe(false);
    expect(isLevel("")).toBe(false);
    expect(isLevel("Intro")).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isLevel(undefined)).toBe(false);
    expect(isLevel(null)).toBe(false);
    expect(isLevel(0)).toBe(false);
    expect(isLevel({})).toBe(false);
  });

  // Regression: a naive `s in BY_ID` would let `Object.prototype` keys
  // through, then `getLevel(level).mix` crashes at runtime with
  // "Cannot read properties of undefined".
  it("rejects Object.prototype keys", () => {
    expect(isLevel("toString")).toBe(false);
    expect(isLevel("constructor")).toBe(false);
    expect(isLevel("hasOwnProperty")).toBe(false);
    expect(isLevel("__proto__")).toBe(false);
  });
});

describe("toLevel", () => {
  it("returns the level when valid", () => {
    expect(toLevel("intro")).toBe("intro");
    expect(toLevel("challenge")).toBe("challenge");
  });

  it("falls back to DEFAULT_LEVEL for invalid input", () => {
    expect(toLevel("garbage")).toBe(DEFAULT_LEVEL);
    expect(toLevel("toString")).toBe(DEFAULT_LEVEL);
    expect(toLevel(undefined)).toBe(DEFAULT_LEVEL);
  });
});
