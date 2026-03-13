import type { BM25Params, DehydratedTool, SearchResult, TokenStats } from "./types";

/**
 * Tokenize text into searchable tokens
 * Handles camelCase, snake_case, and natural language
 */
export function tokenize(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

/**
 * Best Matching 25 (BM25) implementation
 */
export class BM25Engine {
  private index = new Map<string, { docIds: Set<number>; stats: TokenStats }>();
  private docLengths: number[] = [];
  private avgDocLength: number = 0;
  private params: BM25Params;

  constructor(
    private tools: DehydratedTool[],
    params: BM25Params = { k1: 1.2, b: 0.75 },
  ) {
    this.params = params;
    this.buildIndex();
  }

  private buildIndex() {
    const N = this.tools.length;
    let totalLength = 0;

    for (let i = 0; i < N; i++) {
      const tool = this.tools[i];
      const text = [tool.name, tool.category, tool.description, JSON.stringify(tool.inputSchema)].join(" ");

      const tokens = tokenize(text);
      const uniqueTokens = new Set(tokens);

      this.docLengths[i] = tokens.length;
      totalLength += tokens.length;

      for (const token of uniqueTokens) {
        let entry = this.index.get(token);
        if (!entry) {
          entry = { docIds: new Set(), stats: { df: 0, idf: 0 } };
          this.index.set(token, entry);
        }
        entry.docIds.add(i);
      }
    }

    this.avgDocLength = totalLength / N;

    // Calculate IDF
    for (const [token, entry] of this.index) {
      const df = entry.docIds.size;
      entry.stats.df = df;
      entry.stats.idf = Math.log((N - df + 0.5) / (df + 0.5) + 1.0);
    }
  }

  search(query: string, limit: number): SearchResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const results: { index: number; score: number }[] = [];

    for (let i = 0; i < this.tools.length; i++) {
      let score = 0;
      const docLength = this.docLengths[i];
      const tool = this.tools[i];
      const text = [tool.name, tool.category, tool.description, JSON.stringify(tool.inputSchema)].join(" ");
      const docTokens = tokenize(text);

      for (const qToken of queryTokens) {
        const entry = this.index.get(qToken);
        if (!entry) continue;

        const tf = docTokens.filter((t) => t === qToken).length;
        const idf = entry.stats.idf;

        const numerator = idf * tf * (this.params.k1 + 1);
        const denominator = tf + this.params.k1 * (1 - this.params.b + this.params.b * (docLength / this.avgDocLength));

        score += numerator / denominator;
      }

      if (score > 0) {
        results.push({ index: i, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => ({
        ...this.tools[r.index],
        score: r.score,
      }));
  }
}
