/**
 * BM25 (Best Matching 25) Implementation
 * 
 * A bag-of-words retrieval function used for ranking documents
 * based on query terms. Optimized for small language models.
 * 
 * Parameters (tuned for tool search):
 * - k1: 0.9 (term frequency saturation - lower for vague queries)
 * - b: 0.4 (length normalization - lower penalizes long docs less)
 */

export interface BM25Params {
  k1: number
  b: number
}

export class BM25 {
  private corpus: string[][]
  private idf: Map<string, number>
  private docFreq: Map<string, number>
  private avgDocLength: number
  private params: BM25Params

  constructor(
    corpus: string[][],
    params: BM25Params = { k1: 0.9, b: 0.4 }
  ) {
    this.corpus = corpus
    this.params = params
    this.idf = new Map()
    this.docFreq = new Map()
    this.avgDocLength = 0

    this.index()
  }

  /**
   * Build BM25 index
   */
  private index(): void {
    const n = this.corpus.length
    const termFreq: Map<string, number>[] = []

    // Calculate term frequencies per document
    for (const doc of this.corpus) {
      const freq = new Map<string, number>()
      for (const term of doc) {
        freq.set(term, (freq.get(term) || 0) + 1)
      }
      termFreq.push(freq)
    }

    // Calculate document frequencies
    for (const freq of termFreq) {
      for (const term of freq.keys()) {
        this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1)
      }
    }

    // Calculate IDF for each term
    for (const [term, df] of this.docFreq.entries()) {
      const idf = Math.log((n - df + 0.5) / (df + 0.5) + 1)
      this.idf.set(term, idf)
    }

    // Calculate average document length
    const totalLength = this.corpus.reduce((sum, doc) => sum + doc.length, 0)
    this.avgDocLength = totalLength / n
  }

  /**
   * Search corpus with query
   */
  search(query: string[]): number[] {
    const scores: number[] = []

    for (let i = 0; i < this.corpus.length; i++) {
      const doc = this.corpus[i]
      const score = this.scoreQuery(query, doc, i)
      scores.push(score)
    }

    return scores
  }

  /**
   * Score a single document for a query
   */
  private scoreQuery(
    query: string[],
    doc: string[],
    docIdx: number
  ): number {
    const { k1, b } = this.params
    const docLen = doc.length

    const termFreq = new Map<string, number>()
    for (const term of doc) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1)
    }

    let score = 0

    for (const qTerm of query) {
      const tf = termFreq.get(qTerm) || 0
      const idf = this.idf.get(qTerm) || 0

      if (tf > 0 && idf > 0) {
        const numerator = tf * (k1 + 1)
        const denominator = tf + k1 * (1 - b + b * (docLen / this.avgDocLength))
        score += idf * (numerator / denominator)
      }
    }

    return score
  }
}
