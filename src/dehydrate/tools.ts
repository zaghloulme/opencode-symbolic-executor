import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import type { ToolRegistry } from "./registry";

export const createDehydratedTools = (registry: ToolRegistry) => ({
  search_tools: tool({
    description:
      "Search for available tools in the registry. Use this to discover which symbolic or external tools are available for your task.",
    args: {
      query: z
        .string()
        .describe("A natural language description of what you want to do (e.g., 'find symbol in codebase')"),
      limit: z.number().optional().default(5).describe("Maximum number of results to return"),
    },
    async execute({ query, limit }) {
      const results = registry.search(query, limit);
      if (results.length === 0) {
        return "No matching tools found in the registry.";
      }

      const formatted = results
        .map(
          (r) =>
            `- **${r.name}** [${r.server}/${r.category}]: ${r.description.slice(0, 80)}${r.description.length > 80 ? "..." : ""}`,
        )
        .join("\n");

      return `Found ${results.length} tools:\n\n${formatted}\n\nUse 'get_tool_schema' with the tool name to see its full definition.`;
    },
  }),

  get_tool_schema: tool({
    description:
      "Retrieve the full schema and examples for a tool discovered via 'search_tools'. Call this before attempting to use a tool to understand its required arguments.",
    args: {
      tool_name: z.string().describe("The name of the tool to retrieve the schema for"),
    },
    async execute({ tool_name }) {
      const tool = registry.getTool(tool_name);
      if (!tool) {
        return `Tool '${tool_name}' not found in registry.`;
      }

      return JSON.stringify(
        {
          name: tool.name,
          server: tool.server,
          description: tool.description,
          inputSchema: tool.inputSchema,
          example: tool.example || "No example provided.",
        },
        null,
        2,
      );
    },
  }),
});
