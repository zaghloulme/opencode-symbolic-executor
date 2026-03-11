/**
 * Search Decisions Tool
 * 
 * Search decision logs by keyword, type, or SPEC reference.
 * Returns excerpts (not full content) to save context.
 */

import type { Project } from "../utils/client-types"

export interface SearchDecisionsInput {
  /**
   * Search keywords
   */
  keywords: string[]

  /**
   * Decision type filter
   */
  type?: "design" | "architecture" | "library" | "security"

  /**
   * SPEC reference filter
   */
  specReference?: string
}

export interface DecisionExcerpt {
  id: string
  title: string
  date: string
  specReference?: string
  excerpt: string
}

export function searchDecisionsTool(project: Project) {
  return {
    description: "Search decision logs by keyword, type, or SPEC reference. Returns excerpts - load full decision if needed.",
    input_schema: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          description: "Search keywords",
          items: { type: "string" },
        },
        type: {
          type: "string",
          description: "Decision type filter",
          enum: ["design", "architecture", "library", "security"],
        },
        specReference: {
          type: "string",
          description: "SPEC reference filter (e.g., 'SPEC-001')",
        },
      },
      required: ["keywords"],
    },

    async execute(input: SearchDecisionsInput): Promise<DecisionExcerpt[]> {
      const fs = await import("node:fs/promises")
      const path = await import("node:path")

      const decisionsDir = path.join(project.root, ".opencode/decisions")

      try {
        const files = await fs.readdir(decisionsDir)
        const results: DecisionExcerpt[] = []

        for (const file of files) {
          if (!file.endsWith(".md")) continue

          const filePath = path.join(decisionsDir, file)
          const content = await fs.readFile(filePath, "utf-8")

          // Check if matches search
          if (matchesSearch(content, input)) {
            results.push({
              id: file.replace(".md", ""),
              title: extractTitle(content),
              date: extractDate(file),
              specReference: extractSPECReference(content),
              excerpt: content.slice(0, 200) + "...",
            })
          }
        }

        return results
      } catch {
        // Directory doesn't exist yet
        return []
      }
    },
  }
}

function matchesSearch(content: string, input: SearchDecisionsInput): boolean {
  const contentLower = content.toLowerCase()

  // Check keywords
  const hasKeywords = input.keywords.some((k) => contentLower.includes(k.toLowerCase()))

  // Check type
  const hasType = !input.type || contentLower.includes(input.type.toLowerCase())

  // Check SPEC reference
  const hasSPEC = !input.specReference || content.includes(input.specReference)

  return hasKeywords && hasType && hasSPEC
}

function extractTitle(content: string): string {
  const match = content.match(/^# (.+)$/m)
  return match ? match[1] : "Untitled Decision"
}

function extractDate(file: string): string {
  const match = file.match(/DEC-(\d{4})-(\d+)/)
  return match ? `${match[1]}-${match[2]}` : "Unknown"
}

function extractSPECReference(content: string): string | undefined {
  const match = content.match(/SPEC-(\d+)/)
  return match ? `SPEC-${match[1]}` : undefined
}
