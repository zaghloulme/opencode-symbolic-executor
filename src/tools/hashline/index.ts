/**
 * Hashline edit tool definition
 * Exports createHashlineEditTool for registration in plugin
 */

import fs from "node:fs/promises";
import path from "node:path";
import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { executeHashlineEdits } from "./executor";

/**
 * Create hashline edit tool definition
 * Registers the hashline_edit tool with OpenCode
 */
export function createHashlineEditTool(directory: string) {
  return tool({
    description:
      "Edit files using LINE#ID format for precise, safe modifications. Hash-validated line references prevent stale edits.",
    args: {
      filePath: z.string().describe("Path to file to edit (relative to project root)"),
      edits: z
        .array(
          z.object({
            op: z.enum(["replace", "append", "prepend"]).describe("Edit operation type"),
            pos: z.string().optional().describe('LINE#ID anchor for operation (e.g., "11#VK")'),
            end: z.string().optional().describe("LINE#ID end anchor for range operations"),
            lines: z.union([z.string(), z.array(z.string())]).describe("New content (plain text, no LINE#ID prefixes)"),
          }),
        )
        .describe("Array of edit operations"),
      delete: z.boolean().optional().describe("If true, delete the file (edits must be empty)"),
      rename: z.string().optional().describe("If provided, rename file to this path after editing"),
    },
    async execute(args) {
      try {
        // Resolve file path
        const fullPath = path.join(directory, args.filePath);

        // Read current file content
        let content: string;
        try {
          content = await fs.readFile(fullPath, "utf-8");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            // File doesn't exist - check if we're creating it
            const hasUnanchoredInsert = args.edits.some((e) => (e.op === "append" || e.op === "prepend") && !e.pos);
            if (hasUnanchoredInsert) {
              content = "";
            } else {
              return JSON.stringify({
                success: false,
                error: `File not found: ${args.filePath}. Use unanchored append/prepend to create new files.`,
              });
            }
          } else {
            throw error;
          }
        }

        // Execute hashline edits
        const result = await executeHashlineEdits(content, {
          filePath: args.filePath,
          edits: args.edits,
          delete: args.delete,
          rename: args.rename,
        });

        if (!result.success) {
          return JSON.stringify(result);
        }

        // Write updated content
        if (args.delete) {
          await fs.unlink(fullPath);
        } else {
          // Strip hashline prefixes before writing
          const contentToWrite = result
            .updatedContent!.split("\n")
            .map((line) => line.replace(/^\d+#[ZPMQVRWSNKTXJBYH]{2}\|/, ""))
            .join("\n");

          const writePath = args.rename ? path.join(directory, args.rename) : fullPath;

          // Ensure directory exists
          await fs.mkdir(path.dirname(writePath), { recursive: true });
          await fs.writeFile(writePath, contentToWrite, "utf-8");
        }

        return JSON.stringify({
          success: true,
          diff: result.diff,
          filePath: result.filePath,
          message: "File edited successfully",
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: (error as Error).message,
        });
      }
    },
  });
}
