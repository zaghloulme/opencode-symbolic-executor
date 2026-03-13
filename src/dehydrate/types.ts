export interface DehydratedTool {
  name: string;
  server: string;
  category: string;
  description: string;
  inputSchema: any;
  example?: string;
}

export interface SearchResult {
  name: string;
  server: string;
  category: string;
  description: string;
  score: number;
}

export interface BM25Params {
  k1: number;
  b: number;
}

export interface TokenStats {
  df: number;
  idf: number;
}
