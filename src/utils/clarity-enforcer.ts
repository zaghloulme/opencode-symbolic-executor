/**
 * Clarity Enforcer
 * 
 * Detects and blocks assumptions in agent messages.
 * Enforces traceability requirements for all decisions.
 */

import type { OpencodeClient, Message } from "../utils/client-types"

const UNCLEAR_PATTERNS = [
  { pattern: /assume/i, severity: "error" as const },
  { pattern: /guess/i, severity: "error" as const },
  { pattern: /probably/i, severity: "warning" as const },
  { pattern: /maybe/i, severity: "error" as const },
  { pattern: /should work/i, severity: "error" as const },
  { pattern: /I think/i, severity: "warning" as const },
  { pattern: /likely/i, severity: "warning" as const },
]

export async function clarityEnforcer(client: OpencodeClient, message: Message): Promise<void> {
  const { content } = message

  // Check for assumptions
  for (const rule of UNCLEAR_PATTERNS) {
    if (rule.pattern.test(content)) {
      if (rule.severity === "error") {
        await client.notify(`BLOCKED: Assumption detected - "${rule.pattern}"`)
        await client.notify("REQUIRED: Ask clarifying question instead of assuming")
      } else {
        await client.notify(`WARNING: Unclear language - "${rule.pattern}"`)
      }
    }
  }

  // Check for missing traceability
  if (hasDecision(content) && !hasSources(content)) {
    await client.notify("MISSING_SOURCE: Decisions must cite sources (URLs, docs, SPEC refs)")
  }
}

function hasDecision(content: string): boolean {
  return /chose|chosen|decided|decision|selected/i.test(content)
}

function hasSources(content: string): boolean {
  return /https?:\/\/|Context7:|SPEC-\d+|per |according to/i.test(content)
}
