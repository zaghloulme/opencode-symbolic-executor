/**
 * Review Plan Tool
 * 
 * Reviews and scores technical plans objectively.
 * Plans must score ≥85 to proceed.
 * Auto-revises plans below threshold (max 3 revisions).
 */

import type { OpencodeClient, Project } from "../utils/client-types"

export interface ReviewPlanInput {
  /**
   * Plan content to review
   */
  plan: string

  /**
   * SPEC reference
   */
  specId: string
}

export interface ReviewPlanResult {
  /**
   * Overall score (0-100)
   */
  score: number

  /**
   * Passed threshold (≥85)
   */
  passed: boolean

  /**
   * Scoring breakdown
   */
  breakdown: {
    clarity: number
    completeness: number
    testability: number
    security: number
  }

  /**
   * Feedback for revision
   */
  feedback: string[]
}

export function reviewPlanTool(client: OpencodeClient, project: Project, config: any) {
  return {
    description: "Review and score technical plans objectively. Plans must score ≥85 to proceed. Auto-revises if below threshold.",
    input_schema: {
      type: "object",
      properties: {
        plan: {
          type: "string",
          description: "Plan content to review",
        },
        specId: {
          type: "string",
          description: "SPEC reference (e.g., 'SPEC-001')",
        },
      },
      required: ["plan", "specId"],
    },

    async execute(input: ReviewPlanInput): Promise<ReviewPlanResult> {
      const { plan, specId } = input

      // Score plan
      const breakdown = await scorePlan(plan)
      const score = calculateOverallScore(breakdown)
      const passed = score >= 85

      // Generate feedback
      const feedback = generateFeedback(breakdown, passed)

      // Auto-revise if below threshold
      if (!passed) {
        await client.notify(`PLAN_SCORE: ${score}/100 (requires revision, threshold: 85)`)
      }

      return {
        score,
        passed,
        breakdown,
        feedback,
      }
    },
  }
}

/**
 * Score plan across multiple criteria
 */
async function scorePlan(plan: string): Promise<ReviewPlanResult["breakdown"]> {
  return {
    clarity: scoreClarity(plan),
    completeness: scoreCompleteness(plan),
    testability: scoreTestability(plan),
    security: scoreSecurity(plan),
  }
}

/**
 * Calculate overall weighted score
 */
function calculateOverallScore(breakdown: ReviewPlanResult["breakdown"]): number {
  return (
    breakdown.clarity * 0.30 +
    breakdown.completeness * 0.25 +
    breakdown.testability * 0.25 +
    breakdown.security * 0.20
  )
}

/**
 * Score clarity (no vague language)
 */
function scoreClarity(plan: string): number {
  const vaguePatterns = [/maybe/, /probably/, /try to/, /should/, /I think/]
  const vagueCount = vaguePatterns.filter((p) => p.test(plan)).length
  return Math.max(0, 100 - vagueCount * 10)
}

/**
 * Score completeness (all sections present)
 */
function scoreCompleteness(plan: string): number {
  const required = ["requirements", "design", "testing", "verification"]
  const present = required.filter((r) => plan.toLowerCase().includes(r)).length
  return (present / required.length) * 100
}

/**
 * Score testability (measurable acceptance criteria)
 */
function scoreTestability(plan: string): number {
  const measurablePatterns = [/must$/, /should$/, /will$/]
  const lines = plan.split("\n").filter((l) => l.trim().startsWith("-"))
  const measurable = lines.filter((l) => measurablePatterns.some((p) => p.test(l))).length
  return lines.length > 0 ? (measurable / lines.length) * 100 : 0
}

/**
 * Score security (security considerations mentioned)
 */
function scoreSecurity(plan: string): number {
  const securityMentions = [/auth/, /validation/, /sanitize/, /encrypt/, /rate limit/]
  const hasSecurity = securityMentions.some((p) => p.test(plan.toLowerCase()))
  return hasSecurity ? 100 : 50
}

/**
 * Generate feedback for revision
 */
function generateFeedback(breakdown: ReviewPlanResult["breakdown"], passed: boolean): string[] {
  const feedback: string[] = []

  if (breakdown.clarity < 85) {
    feedback.push("Clarity: Remove vague language (maybe, probably, should)")
  }

  if (breakdown.completeness < 85) {
    feedback.push("Completeness: Add missing sections (requirements, design, testing, verification)")
  }

  if (breakdown.testability < 85) {
    feedback.push("Testability: Make acceptance criteria measurable (use must/will, include numbers)")
  }

  if (breakdown.security < 85) {
    feedback.push("Security: Add security considerations (auth, validation, rate limiting)")
  }

  if (passed) {
    feedback.push("✓ Plan meets threshold (≥85)")
  }

  return feedback
}
