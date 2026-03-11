/**
 * Search Mistakes Tool
 * 
 * Search mistake logs by keyword or category to get unstuck.
 * Returns lessons and prevention checklists.
 */

import type { Project } from "../utils/client-types"

export interface SearchMistakesInput {
  /**
   * Search keywords
   */
  keywords: string[]

  /**
   * Category filter
   */
  category?: "security" | "performance" | "design" | "architecture"
}

export interface MistakeExcerpt {
  id: string
  title: string
  category: string
  lesson: string
  prevention: string
}

export function searchMistakesTool(project: Project) {
  return {
    description: "Search mistake logs by keyword or category to get unstuck. Returns lessons and prevention checklists.",
    input_schema: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          description: "Search keywords",
          items: { type: "string" },
        },
        category: {
          type: "string",
          description: "Category filter",
          enum: ["security", "performance", "design", "architecture"],
        },
      },
      required: ["keywords"],
    },

    async execute(input: SearchMistakesInput): Promise<MistakeExcerpt[]> {
      const fs = await import("node:fs/promises")
      const path = await import("node:path")

      const mistakesDir = path.join(project.root, ".opencode/mistakes")

      try {
        const files = await fs.readdir(mistakesDir)
        const results: MistakeExcerpt[] = []

        for (const file of files) {
          if (!file.endsWith(".md")) continue

          const filePath = path.join(mistakesDir, file)
          const content = await fs.readFile(filePath, "utf-8")

          // Check if matches search
          if (matchesSearch(content, input)) {
            results.push({
              id: file.replace(".md", ""),
              title: extractTitle(content),
              category: extractCategory(content) || "unknown",
              lesson: extractSection(content, "Lesson") || extractSection(content, "How We Got Unstuck") || "",
              prevention: extractSection(content, "Prevention") || "",
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

function matchesSearch(content: string, input: SearchMistakesInput): boolean {
  const contentLower = content.toLowerCase()

  // Check keywords
  const hasKeywords = input.keywords.some((k) => contentLower.includes(k.toLowerCase()))

  // Check category
  const hasCategory = !input.category || contentLower.includes(input.category.toLowerCase())

  return hasKeywords && hasCategory
}

function extractTitle(content: string): string {
  const match = content.match(/^# (.+)$/m)
  return match ? match[1] : "Untitled Mistake"
}

function extractCategory(content: string): string | undefined {
  const match = content.match(/\*\*Category:\*\* (\w+)/i)
  return match ? match[1].toLowerCase() : undefined
}

function extractSection(content: string, section: string): string | undefined {
  const regex = new RegExp(`\\*\\*${section}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*|$)`, "i")
  const match = content.match(regex)
  return match ? match[1].trim() : undefined
}
