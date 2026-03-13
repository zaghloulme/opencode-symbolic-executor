import { describe, expect, it } from "vitest";
import { HASHLINE_ALPHABET } from "../tools/hashline/constants";
import { computeLineHash, formatHashLine, formatHashLines } from "../tools/hashline/hash-computation";

describe("computeLineHash", () => {
  it("returns a 2-character string", () => {
    const hash = computeLineHash(1, "const x = 42;");
    expect(hash).toHaveLength(2);
  });

  it("uses only characters from HASHLINE_ALPHABET", () => {
    for (let i = 1; i <= 50; i++) {
      const hash = computeLineHash(i, `line content ${i}`);
      for (const ch of hash) {
        expect(HASHLINE_ALPHABET).toContain(ch);
      }
    }
  });

  it("is deterministic for same input", () => {
    const h1 = computeLineHash(5, "function hello() {");
    const h2 = computeLineHash(5, "function hello() {");
    expect(h1).toBe(h2);
  });

  it("differs for different content on the same line", () => {
    const h1 = computeLineHash(1, "const a = 1;");
    const h2 = computeLineHash(1, "const b = 2;");
    expect(h1).not.toBe(h2);
  });

  it("handles whitespace-only lines using line number as seed", () => {
    const h1 = computeLineHash(1, "   ");
    const h2 = computeLineHash(2, "   ");
    expect(h1).not.toBe(h2);
  });

  it("normalizes whitespace differences", () => {
    const h1 = computeLineHash(1, "const x = 1;");
    const h2 = computeLineHash(1, "const  x  =  1;");
    expect(h1).toBe(h2);
  });

  it("handles empty string", () => {
    const hash = computeLineHash(1, "");
    expect(hash).toHaveLength(2);
  });

  it("handles CRLF line endings", () => {
    const h1 = computeLineHash(1, "hello\r");
    const h2 = computeLineHash(1, "hello");
    expect(h1).toBe(h2);
  });
});

describe("formatHashLine", () => {
  it("formats as LINE#HASH|content", () => {
    const result = formatHashLine(11, "function hello() {");
    expect(result).toMatch(/^11#[ZPMQVRWSNKTXJBYH]{2}\|function hello\(\) \{$/);
  });
});

describe("formatHashLines", () => {
  it("formats all lines with hash prefixes", () => {
    const content = "line one\nline two\nline three";
    const result = formatHashLines(content);
    const lines = result.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^1#[ZPMQVRWSNKTXJBYH]{2}\|line one$/);
    expect(lines[1]).toMatch(/^2#[ZPMQVRWSNKTXJBYH]{2}\|line two$/);
    expect(lines[2]).toMatch(/^3#[ZPMQVRWSNKTXJBYH]{2}\|line three$/);
  });

  it("returns empty string for empty content", () => {
    expect(formatHashLines("")).toBe("");
  });
});
