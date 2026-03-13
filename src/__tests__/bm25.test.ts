import { describe, expect, it } from "vitest";
import { BM25Engine, tokenize } from "../dehydrate/bm25";
import type { DehydratedTool } from "../dehydrate/types";

describe("tokenize", () => {
  it("splits camelCase into tokens", () => {
    expect(tokenize("findSymbol")).toEqual(["find", "symbol"]);
  });

  it("splits snake_case into tokens", () => {
    expect(tokenize("find_symbol")).toEqual(["find", "symbol"]);
  });

  it("splits kebab-case into tokens", () => {
    expect(tokenize("find-symbol")).toEqual(["find", "symbol"]);
  });

  it("lowercases all tokens", () => {
    expect(tokenize("FindSymbol")).toEqual(["find", "symbol"]);
  });

  it("filters out single-character tokens", () => {
    expect(tokenize("a b c find")).toEqual(["find"]);
  });

  it("returns empty array for empty string", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("BM25Engine", () => {
  const tools: DehydratedTool[] = [
    {
      name: "find_symbol",
      server: "serena",
      category: "code",
      description: "Find a symbol in the codebase by name",
      inputSchema: { type: "object", properties: { name: { type: "string" } } },
    },
    {
      name: "replace_content",
      server: "serena",
      category: "code",
      description: "Replace content in a file at a specific location",
      inputSchema: { type: "object", properties: { file: { type: "string" }, content: { type: "string" } } },
    },
    {
      name: "web_search",
      server: "context7",
      category: "research",
      description: "Search the web for information about a topic",
      inputSchema: { type: "object", properties: { query: { type: "string" } } },
    },
  ];

  it("ranks relevant tools higher", () => {
    const engine = new BM25Engine(tools);
    const results = engine.search("find symbol", 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("find_symbol");
  });

  it("returns results sorted by score descending", () => {
    const engine = new BM25Engine(tools);
    const results = engine.search("search content", 3);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("returns empty array for empty query", () => {
    const engine = new BM25Engine(tools);
    expect(engine.search("", 5)).toEqual([]);
  });

  it("returns empty array for unmatched query", () => {
    const engine = new BM25Engine(tools);
    const results = engine.search("xyznonexistent", 5);
    expect(results).toEqual([]);
  });

  it("respects limit parameter", () => {
    const engine = new BM25Engine(tools);
    const results = engine.search("content", 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});
