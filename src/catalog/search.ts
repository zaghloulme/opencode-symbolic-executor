/**
 * Tool search engine
 * Supports both regex and BM25 search variants
 */

import type { ToolCatalog, ToolIndex, SearchResult, SearchOptions } from './types'
import { searchBM25, searchRegex } from './bm25'

/**
 * Convert catalog to searchable index
 */
function buildSearchIndex(catalog: ToolCatalog): ToolIndex[] {
  const index: ToolIndex[] = []
  
  for (const [serverId, server] of Object.entries(catalog.servers)) {
    for (const tool of server.tools) {
      const propertyNames = Object.keys(tool.inputSchema.properties || {})
      const propertyDescriptions = Object.values(tool.inputSchema.properties || {})
        .map(p => (p as any).description || '')
        .filter(d => d)
      
      index.push({
        serverId,
        toolName: tool.name,
        description: tool.description,
        propertyNames,
        propertyDescriptions: propertyDescriptions as string[],
        fullDefinition: tool,
      })
    }
  }
  
  return index
}

/**
 * Search tools in catalog
 */
export function searchTools(
  catalog: ToolCatalog,
  query: string,
  options: SearchOptions = { limit: 5 }
): SearchResult[] {
  const { limit, bm25Params } = options
  const index = buildSearchIndex(catalog)
  
  // Auto-detect search type based on query
  const useRegex = query.startsWith('/') && query.endsWith('/')
  
  if (useRegex) {
    // Extract pattern from /pattern/ format
    const pattern = query.slice(1, -1)
    return searchRegex(index, pattern, limit)
  } else {
    // Use BM25 for natural language
    return searchBM25(index, query, limit, bm25Params)
  }
}

/**
 * Search with explicit regex mode
 */
export function searchToolsRegex(
  catalog: ToolCatalog,
  pattern: string,
  limit: number = 5
): SearchResult[] {
  const index = buildSearchIndex(catalog)
  return searchRegex(index, pattern, limit)
}

/**
 * Search with explicit BM25 mode
 */
export function searchToolsBM25(
  catalog: ToolCatalog,
  query: string,
  limit: number = 5,
  bm25Params?: { k1: number; b: number }
): SearchResult[] {
  const index = buildSearchIndex(catalog)
  return searchBM25(index, query, limit, bm25Params)
}

/**
 * Get always-load tools from catalog (metadata only, no examples)
 */
export function getAlwaysLoadTools(
  catalog: ToolCatalog,
  alwaysLoadNames: string[]
): SearchResult[] {
  const index = buildSearchIndex(catalog)
  const results: SearchResult[] = []
  
  for (const toolName of alwaysLoadNames) {
    const tool = index.find(t => t.toolName === toolName)
    if (tool) {
      results.push({
        toolName: tool.toolName,
        serverId: tool.serverId,
        description: tool.description,
        inputSchema: tool.fullDefinition.inputSchema,
        examples: [], // Metadata only - examples loaded on-demand
        matchType: 'bm25',
      })
    }
  }
  
  return results
}
