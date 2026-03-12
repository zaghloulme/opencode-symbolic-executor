/**
 * Tool catalog types for lazy MCP tool loading
 */

export interface ToolCatalog {
  version: number
  builtAt: string
  servers: Record<string, MCPServerCatalog>
}

export interface MCPServerCatalog {
  command: string | string[]
  deferLoading: boolean
  triggers?: string[]
  regexPatterns?: string[]
  description?: string
  tools: ToolDefinition[]
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, PropertyDefinition>
    required?: string[]
  }
  examples?: string[]
  serverId?: string
}

export interface PropertyDefinition {
  type: string
  description?: string
  enum?: string[]
  default?: any
}

export interface ToolIndex {
  serverId: string
  toolName: string
  description: string
  propertyNames: string[]
  propertyDescriptions: string[]
  fullDefinition: ToolDefinition
}

export interface SearchResult {
  toolName: string
  serverId: string
  description: string
  inputSchema: ToolDefinition['inputSchema']
  examples?: string[]
  score?: number
  matchType: 'regex' | 'bm25'
}

export interface SearchOptions {
  limit: number
  bm25Params?: {
    k1: number
    b: number
  }
}

export interface CatalogBuildOptions {
  timeoutPerServer?: number
  logDir?: string
}

export interface CatalogBuildResult {
  success: boolean
  catalog?: ToolCatalog
  error?: string
  logs: string[]
}
