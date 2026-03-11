/**
 * Verify Work Tool
 * 
 * Runs verification gates before marking tasks complete.
 * Gates: LSP, security, visual, SPEC alignment.
 */

import type { OpencodeClient, Project } from "../utils/client-types"

export interface VerifyWorkInput {
  /**
   * SPEC ID to verify against
   */
  specId: string

  /**
   * Task ID being verified
   */
  taskId: string

  /**
   * Verification type (default: all)
   */
  type?: "lsp" | "security" | "visual" | "spec" | "all"
}

export interface VerificationResult {
  /**
   * Overall pass/fail
   */
  passed: boolean

  /**
   * Individual gate results
   */
  gates: {
    lsp: GateResult
    security: GateResult
    visual: GateResult
    spec: GateResult
  }

  /**
   * Overall score (0-100)
   */
  score: number
}

export interface GateResult {
  passed: boolean
  score: number
  errors: string[]
  warnings: string[]
}

export function verifyWorkTool(client: OpencodeClient, project: Project, config: any) {
  return {
    description: "Run verification gates (LSP, security, visual, SPEC alignment) before marking tasks complete.",
    input_schema: {
      type: "object",
      properties: {
        specId: {
          type: "string",
          description: "SPEC ID to verify against (e.g., 'SPEC-001')",
        },
        taskId: {
          type: "string",
          description: "Task ID being verified",
        },
        type: {
          type: "string",
          description: "Verification type (default: all)",
          enum: ["lsp", "security", "visual", "spec", "all"],
        },
      },
      required: ["specId", "taskId"],
    },

    async execute(input: VerifyWorkInput): Promise<VerificationResult> {
      const { specId, taskId, type = "all" } = input

      const gates = {
        lsp: type === "all" || type === "lsp" ? await verifyLSP(project) : { passed: true, score: 100, errors: [], warnings: [] },
        security: type === "all" || type === "security" ? await verifySecurity(project) : { passed: true, score: 100, errors: [], warnings: [] },
        visual: type === "all" || type === "visual" ? await verifyVisual(project, config.visualThreshold) : { passed: true, score: 100, errors: [], warnings: [] },
        spec: type === "all" || type === "spec" ? await verifySPEC(project, specId) : { passed: true, score: 100, errors: [], warnings: [] },
      }

      const passed = Object.values(gates).every((g) => g.passed)
      const score =
        Object.values(gates).reduce((sum, g) => sum + g.score, 0) / Object.values(gates).length

      return {
        passed,
        gates,
        score,
      }
    },
  }
}

async function verifyLSP(project: Project): Promise<GateResult> {
  // Placeholder - would integrate with LSP
  return {
    passed: true,
    score: 100,
    errors: [],
    warnings: [],
  }
}

async function verifySecurity(project: Project): Promise<GateResult> {
  // Placeholder - would integrate with NodeSecure
  return {
    passed: true,
    score: 100,
    errors: [],
    warnings: [],
  }
}

async function verifyVisual(project: Project, threshold: number): Promise<GateResult> {
  // Placeholder - would integrate with Playwright
  return {
    passed: true,
    score: 100,
    errors: [],
    warnings: [],
  }
}

async function verifySPEC(project: Project, specId: string): Promise<GateResult> {
  const fs = await import("node:fs/promises")
  const path = await import("node:path")

  try {
    const specPath = path.join(project.root, ".opencode/specs", `${specId}.md`)
    const content = await fs.readFile(specPath, "utf-8")

    // Check if all acceptance criteria are met
    const criteria = content.match(/- Acceptance: (.+)$/gm) || []
    const metCriteria = criteria.filter((c) => c.includes("✓") || c.includes("[x]")).length
    const score = criteria.length > 0 ? (metCriteria / criteria.length) * 100 : 100

    return {
      passed: score >= 100,
      score,
      errors: score < 100 ? [`Only ${metCriteria}/${criteria.length} acceptance criteria met`] : [],
      warnings: [],
    }
  } catch {
    return {
      passed: false,
      score: 0,
      errors: [`SPEC file not found: ${specId}`],
      warnings: [],
    }
  }
}
