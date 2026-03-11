/**
 * Tool Search Tool (Anthropic Pattern)
 * 
 * Allows agents to discover tools on-demand instead of loading all definitions upfront.
 * Supports both BM25 (natural language) and Regex (precise) search.
 * 
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
 */

import type { ToolCatalog } from "../catalog/tool-catalog"

export interface ToolSearchInput {
  /**
   * Search query (natural language or regex)
   * @example "find symbol definitions" or "serena_.*symbol"
   */
  query: string

  /**
   * Max results to return (default: 5)
   */
  limit?: number

  /**
   * Use regex instead of BM25 (default: false)
   */
  useRegex?: boolean
}

/**
 * Create tool search tool
 * 
 * @param catalog - Tool catalog with BM25 index
 * @returns Tool definition for tool search
 */
export function toolSearchTool(catalog: ToolCatalog) {
  return {
    description: "Search for available tools by keyword or natural language. Returns tool references - call getTool() to load full schema.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language description (e.g., 'search codebase symbols', 'Sanity CMS schema') or regex pattern (e.g., 'serena_.*')",
        },
        limit: {
          type: "number",
          description: "Max results to return (default: 5)",
          default: 5,
        },
        useRegex: {
          type: "boolean",
          description: "Use regex search instead of BM25 (default: false). Use when you know exact tool name pattern.",
          default: false,
        },
      },
      required: ["query"],
    },

    /**
     * Tool Use Examples (Anthropic pattern)
     * 
     * Shows correct usage patterns for better accuracy.
     * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use#providing-tool-use-examples
     */
    input_examples: [
      {
        query: "find symbol definitions in codebase",
        limit: 3,
      },
      {
        query: "Sanity CMS schema operations",
        useRegex: false,
      },
      {
        query: "serena_.*symbol",
        useRegex: true,
      },
      {
        query: "visual verification screenshot",
        limit: 5,
      },
    ],

    /**
     * Tool implementation
     */
    async execute(input: ToolSearchInput) {
      const { query, limit = 5, useRegex = false } = input

      // Search catalog
      const results = await catalog.search(query, limit, useRegex)

      // Return tool references (Anthropic standard format)
      return {
        type: "tool_search_result",
        content: results.map((result) => ({
          type: "tool_reference",
          tool_name: result.tool_name,
          description: result.description,
          score: result.score,
        })),
      }
    },
  }
}
