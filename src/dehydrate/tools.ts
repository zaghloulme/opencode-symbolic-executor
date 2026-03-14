import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import type { ToolRegistry } from "./registry";

type OpencodeClient = {
  tool: {
    ids: (options?: any) => Promise<{ data?: string[] }>;
  };
};

export const createDehydratedTools = (registry: ToolRegistry, client: OpencodeClient) => ({
  search_tools: tool({
    description:
      "Search for available tools. Combines the plugin registry (Serena, hashline, SPEC tools) with ALL tools currently loaded in OpenCode (MCP servers, built-in tools). Use this to discover what tools you can call.",
    args: {
      query: z
        .string()
        .describe("A natural language description of what you want to do (e.g., 'edit code', 'git commit', 'find symbol')"),
      limit: z.number().optional().default(10).describe("Maximum number of results to return"),
    },
    async execute({ query, limit }) {
      const sections: string[] = [];

      const registryResults = registry.search(query, limit);
      if (registryResults.length > 0) {
        const formatted = registryResults
          .map(
            (r) =>
              `- **${r.name}** [${r.server}/${r.category}]: ${r.description.slice(0, 100)}${r.description.length > 100 ? "..." : ""}`,
          )
          .join("\n");
        sections.push(`## Registry matches (${registryResults.length})\n\n${formatted}`);
      }

      try {
        const response = await client.tool.ids();
        const allIds = response.data || [];
        if (allIds.length > 0) {
          const queryLower = query.toLowerCase();
          const keywords = queryLower.split(/\s+/).filter((w) => w.length > 2);

          const matched = allIds.filter((id: string) => {
            const idLower = id.toLowerCase();
            return keywords.some((kw) => idLower.includes(kw)) || idLower.includes(queryLower.replace(/\s+/g, "_"));
          });

          const registryNames = new Set(registryResults.map((r) => r.name));
          const liveOnly = matched.filter((id: string) => !registryNames.has(id));

          if (liveOnly.length > 0) {
            sections.push(`## Live tools matching "${query}" (${liveOnly.length})\n\n${liveOnly.map((id: string) => `- ${id}`).join("\n")}`);
          }

          const mcpTools = allIds.filter((id: string) => id.startsWith("mcp__"));
          const servers = new Map<string, number>();
          for (const id of mcpTools) {
            const parts = id.split("__");
            if (parts.length >= 3) {
              const server = parts[1];
              servers.set(server, (servers.get(server) || 0) + 1);
            }
          }
          if (servers.size > 0) {
            const serverList = Array.from(servers.entries())
              .map(([name, count]) => `- **mcp__${name}__*** (${count} tools)`)
              .join("\n");
            sections.push(`## Connected MCP servers\n\n${serverList}`);
          }

          const builtIn = allIds.filter((id: string) => !id.startsWith("mcp__"));
          if (builtIn.length > 0) {
            sections.push(`## Built-in tools (${builtIn.length})\n\n${builtIn.join(", ")}`);
          }
        }
      } catch {
        sections.push("_Could not query live tools from OpenCode runtime._");
      }

      if (sections.length === 0) {
        return "No matching tools found.";
      }

      return sections.join("\n\n");
    },
  }),

  get_tool_schema: tool({
    description:
      "Retrieve the full schema and examples for a tool discovered via 'search_tools'. Call this before attempting to use a tool to understand its required arguments.",
    args: {
      tool_name: z.string().describe("The name of the tool to retrieve the schema for"),
    },
    async execute({ tool_name }) {
      const found = registry.getTool(tool_name);
      if (!found) {
        return `Tool '${tool_name}' not found in registry. If it's an MCP or built-in tool, call it directly — OpenCode provides its schema automatically.`;
      }

      return JSON.stringify(
        {
          name: found.name,
          server: found.server,
          description: found.description,
          inputSchema: found.inputSchema,
          example: found.example || "No example provided.",
        },
        null,
        2,
      );
    },
  }),
});
