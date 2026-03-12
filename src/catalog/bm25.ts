/**
 * BM25 (Best Matching 25) scoring algorithm for tool search
 * Configurable with k1 and b parameters
 */

import type { ToolIndex, SearchResult } from './types'

interface BM25Params {
  k1: number  // Term frequency scaling (default: 0.9)
  b: number   // Length normalization (default: 0.4)
}

interface TokenStats {
  df: number  // Document frequency
  idf: number // Inverse document frequency
}

/**
 * Tokenize text into searchable tokens
 * Handles camelCase, snake_case, and natural language
 */
function tokenize(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase -> camel Case
    .replace(/_/g, ' ')                     // snake_case -> snake case
    .replace(/-/g, ' ')                     // kebab-case -> kebab case
    .toLowerCase()
    .split(/\s+/)
    .filter(token => token.length > 1)      // Remove single chars
}

/**
 * Build inverted index for BM25 search
 */
export function buildInvertedIndex(
  tools: ToolIndex[]
): Map<string, { docIds: Set<number>; stats: TokenStats }> {
  const index = new Map<string, { docIds: Set<number>; stats: TokenStats }>()
  const docLengths = new Map<number, number>()
  
  // Calculate document frequencies
  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i]
    const tokens = new Set<string>()
    
    // Tokenize all searchable fields
    const searchableText = [
      tool.toolName,
      tool.description,
      ...tool.propertyNames,
      ...tool.propertyDescriptions,
    ].join(' ')
    
    const toolTokens = tokenize(searchableText)
    toolTokens.forEach(token => tokens.add(token))
    
    // Update document frequency for each token
    docLengths.set(i, tokens.size)
    
    for (const token of tokens) {
      let tokenData = index.get(token)
      if (!tokenData) {
        tokenData = {
          docIds: new Set(),
          stats: { df: 0, idf: 0 },
        }
        index.set(token, tokenData)
      }
      tokenData.docIds.add(i)
    }
  }
  
  // Calculate IDF for each token
  const N = tools.length
  for (const [token, data] of index) {
    const df = data.docIds.size
    data.stats.df = df
    data.stats.idf = Math.log((N - df + 0.5) / (df + 0.5) + 1)
  }
  
  return index
}

/**
 * Calculate BM25 score for a document
 */
function calculateBM25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDocLength: number,
  params: BM25Params,
  index: Map<string, { docIds: Set<number>; stats: TokenStats }>
): number {
  let score = 0
  const docLength = docTokens.length
  
  for (const queryToken of queryTokens) {
    const tokenData = index.get(queryToken)
    if (!tokenData) continue
    
    // Calculate term frequency in document
    const tf = docTokens.filter(t => t === queryToken).length
    
    // BM25 formula
    const numerator = tokenData.stats.idf * tf * (params.k1 + 1)
    const denominator = tf + params.k1 * (1 - params.b + params.b * (docLength / avgDocLength))
    
    score += numerator / denominator
  }
  
  return score
}

/**
 * Search tools using BM25 algorithm
 */
export function searchBM25(
  tools: ToolIndex[],
  query: string,
  limit: number,
  params: BM25Params = { k1: 0.9, b: 0.4 }
): SearchResult[] {
  const queryTokens = tokenize(query)
  
  if (queryTokens.length === 0) {
    return []
  }
  
  const index = buildInvertedIndex(tools)
  const avgDocLength = tools.reduce((sum, tool) => {
    const text = [
      tool.toolName,
      tool.description,
      ...tool.propertyNames,
      ...tool.propertyDescriptions,
    ].join(' ')
    return sum + tokenize(text).length
  }, 0) / tools.length
  
  // Score each tool
  const scores: Array<{ tool: ToolIndex; score: number }> = []
  
  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i]
    const searchableText = [
      tool.toolName,
      tool.description,
      ...tool.propertyNames,
      ...tool.propertyDescriptions,
    ].join(' ')
    
    const docTokens = tokenize(searchableText)
    const score = calculateBM25Score(queryTokens, docTokens, avgDocLength, params, index)
    
    if (score > 0) {
      scores.push({ tool, score })
    }
  }
  
  // Sort by score descending
  scores.sort((a, b) => b.score - a.score)
  
  // Return top results
  return scores.slice(0, limit).map(({ tool, score }) => ({
    toolName: tool.toolName,
    serverId: tool.serverId,
    description: tool.description,
    inputSchema: tool.fullDefinition.inputSchema,
    examples: tool.fullDefinition.examples,
    score,
    matchType: 'bm25' as const,
  }))
}

/**
 * Search tools using regex pattern
 */
export function searchRegex(
  tools: ToolIndex[],
  pattern: string,
  limit: number
): SearchResult[] {
  try {
    // Compile regex (Python re.search syntax compatible)
    const regex = new RegExp(pattern, 'i')
    
    const matches: Array<{ tool: ToolIndex; score: number }> = []
    
    for (const tool of tools) {
      const searchableText = [
        tool.toolName,
        tool.description,
        ...tool.propertyNames,
        ...tool.propertyDescriptions,
      ].join(' ')
      
      if (regex.test(searchableText)) {
        // Score based on match position and field
        let score = 1
        
        // Exact name match gets highest score
        if (regex.test(tool.toolName)) {
          score += 10
        }
        
        // Match in description gets medium score
        if (regex.test(tool.description)) {
          score += 5
        }
        
        matches.push({ tool, score })
      }
    }
    
    // Sort by score descending
    matches.sort((a, b) => b.score - a.score)
    
    // Return top results
    return matches.slice(0, limit).map(({ tool, score }) => ({
      toolName: tool.toolName,
      serverId: tool.serverId,
      description: tool.description,
      inputSchema: tool.fullDefinition.inputSchema,
      examples: tool.fullDefinition.examples,
      score,
      matchType: 'regex' as const,
    }))
  } catch (error) {
    // Invalid regex, return empty results
    return []
  }
}
