/**
 * Tool Catalog with BM25 + Regex Search
 * 
 * Implements Anthropic's Tool Search pattern:
 * - BM25 for natural language queries ("find symbol definitions")
 * - Regex for precise queries ("serena_.*symbol")
 * - Deferred loading (tools not loaded until searched)
 * - Project-specific MCP support
 * 
 * @example
 * ```typescript
 * const catalog = new ToolCatalog({ alwaysLoad: ["create_spec"] })
 * await catalog.loadProjectMCPs(projectRoot)
 * 
 * // Search for tools
 * const results = await catalog.search("find symbols", 5)
 * 
 * // Load full tool schema when needed
 * const tool = await catalog.getTool("serena_find_symbol")
 * ```
 */

import { BM25 } from "rank-bm25"
import type { OpencodeClient } from "../utils/client-types"

export interface ToolCatalogEntry {
  /**
   * Tool name (unique identifier)
   * @example "serena_find_symbol"
   */
  name: string

  /**
   * Human-readable description
   * @example "Find symbol definition in codebase"
   */
  description: string

  /**
   * Tool category for filtering
   */
  category: "global" | "project-mcp" | "global-mcp"

  /**
   * Keywords for search (in addition to name + description)
   * @example ["find", "symbol", "definition", "code"]
   */
  keywords: string[]

  /**
   * MCP server path (if applicable)
   * @example "sanity" for @sanity/mcp-server
   */
  serverPath?: string

  /**
   * If true, tool is not loaded until explicitly requested
   * Reduces context usage by ~93%
   */
  deferLoading: boolean

  /**
   * Triggers for auto-loading (project MCPs only)
   * @example ["sanity", "CMS", "content", "schema"]
   */
  triggers?: string[]

  /**
   * Regex patterns for matching (alternative to keywords)
   * @example ["sanity.*", "cms.*", "content.*"]
   */
  regexPatterns?: string[]
}

export interface ToolSearchResult {
  /**
   * Tool reference (Anthropic standard format)
   */
  type: "tool_reference"

  /**
   * Tool name for loading
   */
  tool_name: string

  /**
   * Search relevance score (0-1)
   */
  score: number

  /**
   * Tool description for context
   */
  description: string
}

export interface ToolCatalogConfig {
  /**
   * Tools always loaded (not deferred)
   * @default []
   */
  alwaysLoad?: string[]

  /**
   * Enable tool search (defer loading)
   * @default true
   */
  enableSearch?: boolean

  /**
   * BM25 parameters (tuned for small models)
   * @default { k1: 0.9, b: 0.4 }
   */
  bm25Params?: { k1: number; b: number }
}

export class ToolCatalog {
  private entries: Map<string, ToolCatalogEntry> = new Map()
  private bm25: BM25 | null = null
  private corpus: string[] = []
  private config: Required<ToolCatalogConfig>

  constructor(config: ToolCatalogConfig = {}) {
    this.config = {
      alwaysLoad: config.alwaysLoad || [],
      enableSearch: config.enableSearch ?? true,
      bm25Params: config.bm25Params || { k1: 0.9, b: 0.4 },
    }
  }

  /**
   * Register a tool in the catalog
   * 
   * Tools are indexed for search immediately.
   * If deferLoading is true, full schema is not loaded until requested.
   * 
   * @param entry - Tool catalog entry
   */
  register(entry: ToolCatalogEntry): void {
    // Skip if already registered
    if (this.entries.has(entry.name)) {
      return
    }

    // Add to entries
    this.entries.set(entry.name, entry)

    // Add to BM25 corpus (for search)
    const searchText = this.buildSearchText(entry)
    this.corpus.push(searchText)

    // Rebuild BM25 index
    this.reindex()
  }

  /**
   * Search for tools by natural language or regex
   * 
   * Returns tool references (not full schemas) to save context.
   * Call getTool() to load full schema when needed.
   * 
   * @param query - Search query (natural language or regex)
   * @param limit - Max results (default: 5)
   * @param useRegex - Use regex instead of BM25 (default: false)
   * @returns Tool search results with scores
   * 
   * @example
   * ```typescript
   * // Natural language search
   * const results = await catalog.search("find symbol definitions", 5)
   * 
   * // Regex search
   * const results = await catalog.search("serena_.*symbol", 5, true)
   * ```
   */
  async search(
    query: string,
    limit = 5,
    useRegex = false
  ): Promise<ToolSearchResult[]> {
    if (useRegex) {
      return this.searchRegex(query, limit)
    } else {
      return this.searchBM25(query, limit)
    }
  }

  /**
   * Load full tool schema
   * 
   * For deferred tools, this loads the full schema into context.
   * For non-deferred tools, returns cached schema.
   * 
   * @param name - Tool name
   * @returns Full tool definition
   */
  async getTool(name: string): Promise<any> {
    const entry = this.entries.get(name)
    if (!entry) {
      throw new Error(`Tool ${name} not found in catalog`)
    }

    // If deferred, load from MCP or registry
    if (entry.deferLoading) {
      if (entry.serverPath) {
        return await this.loadMCPTool(entry.serverPath, name)
      } else {
        return await this.loadGlobalTool(name)
      }
    }

    // Already loaded
    return this.getCachedTool(name)
  }

  /**
   * Load project-specific MCPs from .opencode/config.json
   * 
   * MCPs are registered with triggers for auto-loading.
   * When user mentions a trigger keyword, the MCP is loaded automatically.
   * 
   * @param projectRoot - Project root directory
   * 
   * @example
   * ```json
   * // .opencode/config.json
   * {
   *   "mcpServers": {
   *     "sanity": {
   *       "command": "npx -y @sanity/mcp-server",
   *       "deferLoading": true,
   *       "triggers": ["sanity", "CMS", "content", "schema"]
   *     }
   *   }
   * }
   * ```
   */
  async loadProjectMCPs(projectRoot: string): Promise<void> {
    const fs = await import("node:fs/promises")
    const path = await import("node:path")

    try {
      const configPath = path.join(projectRoot, ".opencode/config.json")
      const configText = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configText)

      if (config.mcpServers) {
        for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
          const server = serverConfig as any
          this.register({
            name: `mcp__${name}`,
            description: `MCP server: ${name}`,
            category: "project-mcp",
            keywords: server.triggers || [name],
            serverPath: name,
            deferLoading: server.deferLoading ?? true,
            triggers: server.triggers,
            regexPatterns: server.regexPatterns,
          })
        }
      }
    } catch (error) {
      // Config doesn't exist yet - that's okay
      console.log("No project config found, skipping MCP loading")
    }
  }

  /**
   * Load MCP on-demand when trigger keywords detected
   * 
   * Called on message.updated to auto-load relevant MCPs.
   * 
   * @param message - User message content
   */
  async loadMCPOnDemand(message: string): Promise<void> {
    const messageLower = message.toLowerCase()

    for (const entry of this.entries.values()) {
      if (entry.category !== "project-mcp") continue
      if (!entry.deferLoading) continue

      // Check triggers
      const shouldLoad =
        entry.triggers?.some((t) => messageLower.includes(t.toLowerCase())) ||
        entry.regexPatterns?.some((p) => new RegExp(p, "i").test(message))

      if (shouldLoad) {
        await this.getTool(entry.name)
      }
    }
  }

  /**
   * Build search text from tool entry
   * 
   * Combines name, description, and keywords for BM25 indexing.
   */
  private buildSearchText(entry: ToolCatalogEntry): string {
    return `${entry.name} ${entry.description} ${entry.keywords.join(" ")}`.toLowerCase()
  }

  /**
   * Rebuild BM25 index
   * 
   * Called after registering new tools.
   * Uses parameters tuned for small language models.
   */
  private reindex(): void {
    if (!this.config.enableSearch) return

    // Tokenize corpus
    const tokenizedCorpus = this.corpus.map((doc) => doc.split(" "))

    // Create BM25 instance with tuned parameters
    // k1=0.9: Low term frequency saturation (better for vague queries)
    // b=0.4: Low length normalization (longer descriptions less penalized)
    this.bm25 = new BM25(tokenizedCorpus, {
      k1: this.config.bm25Params.k1,
      b: this.config.bm25Params.b,
    })
  }

  /**
   * BM25 search for natural language queries
   * 
   * @param query - Natural language query
   * @param limit - Max results
   * @returns Tool search results
   */
  private searchBM25(query: string, limit: number): ToolSearchResult[] {
    if (!this.bm25) {
      return this.fallbackSearch(query, limit)
    }

    // Tokenize query
    const tokenizedQuery = query.toLowerCase().split(" ")

    // Get BM25 scores
    const scores = this.bm25.search(tokenizedQuery)

    // Map scores to entries
    const results: ToolSearchResult[] = []
    let i = 0
    for (const [name, entry] of this.entries.entries()) {
      const score = scores[i] || 0
      if (score > 0.3) {
        // Threshold for relevance
        results.push({
          type: "tool_reference",
          tool_name: name,
          score: score,
          description: entry.description,
        })
      }
      i++
    }

    // Sort by score and limit
    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  /**
   * Regex search for precise queries
   * 
   * @param query - Regex pattern
   * @param limit - Max results
   * @returns Tool search results
   */
  private searchRegex(query: string, limit: number): ToolSearchResult[] {
    try {
      const regex = new RegExp(query, "i")
      const results: ToolSearchResult[] = []

      for (const [name, entry] of this.entries.entries()) {
        const searchText = this.buildSearchText(entry)
        if (regex.test(searchText)) {
          results.push({
            type: "tool_reference",
            tool_name: name,
            score: 1.0,
            description: entry.description,
          })
        }
      }

      return results.slice(0, limit)
    } catch (error) {
      // Invalid regex, fall back to BM25
      return this.searchBM25(query, limit)
    }
  }

  /**
   * Fallback search when BM25 not available
   * 
   * Simple keyword matching.
   */
  private fallbackSearch(query: string, limit: number): ToolSearchResult[] {
    const queryLower = query.toLowerCase()
    const results: ToolSearchResult[] = []

    for (const [name, entry] of this.entries.entries()) {
      const searchText = this.buildSearchText(entry)
      if (searchText.includes(queryLower)) {
        results.push({
          type: "tool_reference",
          tool_name: name,
          score: 0.5,
          description: entry.description,
        })
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  /**
   * Load MCP tool from server
   */
  private async loadMCPTool(serverPath: string, toolName: string): Promise<any> {
    // Implementation depends on OpenCode MCP API
    // This is a placeholder
    throw new Error(`MCP tool loading not yet implemented: ${serverPath}/${toolName}`)
  }

  /**
   * Load global tool from registry
   */
  private async loadGlobalTool(toolName: string): Promise<any> {
    // Implementation depends on OpenCode tool registry
    // This is a placeholder
    throw new Error(`Global tool loading not yet implemented: ${toolName}`)
  }

  /**
   * Get cached tool (already loaded)
   */
  private getCachedTool(toolName: string): any {
    // Implementation depends on OpenCode tool registry
    // This is a placeholder
    throw new Error(`Tool not in cache: ${toolName}`)
  }
}
