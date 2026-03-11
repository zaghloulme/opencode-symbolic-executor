/**
 * Create SPEC Tool
 * 
 * Generates SPEC documents with requirements, plan, tasks, and verification criteria.
 * Follows BMAD + SPEC-KIT synthesis with iteration tracking.
 */

import type { ToolCatalog } from "../catalog/tool-catalog"
import type { OpencodeClient } from "../utils/client-types"

export interface CreateSPECInput {
  /**
   * Feature description
   * @example "User authentication with OAuth"
   */
  feature: string

  /**
   * Value proposition
   * @example "Users can sign in with one click instead of passwords"
   */
  value: string

  /**
   * Requirements (optional, will be generated if not provided)
   */
  requirements?: SPECRequirement[]
}

export interface SPECRequirement {
  /**
   * Requirement ID (auto-generated: REQ-001)
   */
  id?: string

  /**
   * Actor (who does this?)
   * @example "User", "System", "Admin"
   */
  actor: string

  /**
   * Action (what do they do?)
   * @example "uploads", "creates", "views"
   */
  action: string

  /**
   * Object (what is acted upon?)
   * @example "profile images", "account", "dashboard"
   */
  object: string

  /**
   * Measurable acceptance criteria
   * @example "Files 10KB-5MB, formats .png/.jpg/.webp"
   */
  acceptance: string

  /**
   * Edge cases and boundaries
   * @example "Error if >5MB, error if wrong format"
   */
  edgeCases: string[]

  /**
   * How to verify
   * @example "Test with 5MB file (pass), 6MB file (fail)"
   */
  verification: string
}

export interface SPECResult {
  /**
   * SPEC ID (auto-generated: SPEC-001)
   */
  specId: string

  /**
   * SPEC file path
   */
  filePath: string

  /**
   * Requirements count
   */
  requirementsCount: number

  /**
   * Validation errors (if any)
   */
  errors?: string[]
}

/**
 * Create SPEC tool
 */
export function createSpecTool(client: OpencodeClient, project: any, catalog: ToolCatalog) {
  return {
    description: "Create new SPEC with requirements, plan, tasks, and verification criteria. SPEC must be approved before implementation.",
    input_schema: {
      type: "object",
      properties: {
        feature: {
          type: "string",
          description: "Feature description (e.g., 'User authentication with OAuth')",
        },
        value: {
          type: "string",
          description: "Value proposition (e.g., 'Users can sign in with one click instead of passwords')",
        },
        requirements: {
          type: "array",
          description: "Requirements (optional, will be generated if not provided)",
          items: {
            type: "object",
            properties: {
              actor: { type: "string" },
              action: { type: "string" },
              object: { type: "string" },
              acceptance: { type: "string" },
              edgeCases: { type: "array", items: { type: "string" } },
              verification: { type: "string" },
            },
            required: ["actor", "action", "object", "acceptance", "edgeCases", "verification"],
          },
        },
      },
      required: ["feature", "value"],
    },

    input_examples: [
      {
        feature: "User authentication with OAuth",
        value: "Users can sign in with Google instead of passwords",
      },
      {
        feature: "Profile image upload",
        value: "Users can upload and crop profile pictures",
        requirements: [
          {
            actor: "User",
            action: "uploads",
            object: "profile images",
            acceptance: "Files 10KB-5MB, formats .png/.jpg/.webp",
            edgeCases: ["Error if >5MB", "Error if wrong format"],
            verification: "Test with 5MB file (pass), 6MB file (fail)",
          },
        ],
      },
    ],

    async execute(input: CreateSPECInput): Promise<SPECResult> {
      const fs = await import("node:fs/promises")
      const path = await import("node:path")

      // Generate SPEC ID
      const specId = await generateSPECId(project.root)
      const specPath = path.join(project.root, ".opencode/specs", `SPEC-${specId}.md`)

      // Ensure directory exists
      await fs.mkdir(path.dirname(specPath), { recursive: true })

      // Generate requirements if not provided
      const requirements = input.requirements || await generateRequirements(input.feature, input.value)

      // Validate requirements
      const errors = validateRequirements(requirements)

      // Generate SPEC content
      const specContent = generateSPECContent(specId, input.feature, input.value, requirements)

      // Write SPEC file
      await fs.writeFile(specPath, specContent, "utf-8")

      // Update SPEC index
      await updateSPECIndex(project.root, specId, input.feature)

      return {
        specId: `SPEC-${specId}`,
        filePath: specPath,
        requirementsCount: requirements.length,
        errors: errors.length > 0 ? errors : undefined,
      }
    },
  }
}

/**
 * Generate SPEC ID (sequential)
 */
async function generateSPECId(projectRoot: string): Promise<string> {
  const fs = await import("node:fs/promises")
  const path = await import("node:path")

  const indexPath = path.join(projectRoot, ".opencode/SPEC-INDEX.md")

  try {
    const indexContent = await fs.readFile(indexPath, "utf-8")
    const matches = indexContent.match(/SPEC-(\d+)/g)

    if (matches && matches.length > 0) {
      const lastId = parseInt(matches[matches.length - 1].replace("SPEC-", ""))
      return String(lastId + 1).padStart(3, "0")
    }
  } catch {
    // Index doesn't exist yet
  }

  return "001"
}

/**
 * Generate requirements from feature description
 * 
 * Uses LLM to generate testable requirements.
 */
async function generateRequirements(feature: string, value: string): Promise<SPECRequirement[]> {
  // This would call an LLM to generate requirements
  // For now, return a placeholder
  return [
    {
      actor: "User",
      action: "uses",
      object: feature.toLowerCase(),
      acceptance: `Feature works as described: ${value}`,
      edgeCases: ["Error handling for invalid input", "Loading states during async operations"],
      verification: "Manual testing per acceptance criteria",
    },
  ]
}

/**
 * Validate requirements against schema
 */
function validateRequirements(requirements: SPECRequirement[]): string[] {
  const errors: string[] = []

  requirements.forEach((req, i) => {
    // Check for measurable acceptance criteria
    if (!isMeasurable(req.acceptance)) {
      errors.push(`REQ-${String(i + 1).padStart(3, "0")}: Acceptance criteria must be measurable (include numbers, booleans, or specific values)`)
    }

    // Check for edge cases
    if (!req.edgeCases || req.edgeCases.length === 0) {
      errors.push(`REQ-${String(i + 1).padStart(3, "0")}: Must specify edge cases (boundaries, error states)`)
    }

    // Check for verification method
    if (!req.verification) {
      errors.push(`REQ-${String(i + 1).padStart(3, "0")}: Must specify verification method`)
    }
  })

  return errors
}

/**
 * Check if acceptance criteria is measurable
 */
function isMeasurable(criteria: string): boolean {
  // Look for numbers, booleans, or specific values
  const measurablePatterns = [
    /\d+/, // Numbers
    /true|false/i, // Booleans
    /must|should|will$/, // Measurable language
    /if.*then/i, // Conditional
    /error|fail|pass/i, // Test outcomes
  ]

  return measurablePatterns.some((p) => p.test(criteria))
}

/**
 * Generate SPEC markdown content
 */
function generateSPECContent(specId: string, feature: string, value: string, requirements: SPECRequirement[]): string {
  const reqLines = requirements.map(
    (req) => `
- **REQ-${requirements.indexOf(req) + 1}**: ${req.actor} ${req.action} ${req.object}
  - Acceptance: ${req.acceptance}
  - Edge Cases: ${req.edgeCases.join(", ")}
  - Verification: ${req.verification}
`
  )

  return `# SPEC-${specId}: ${feature}

## Value
${value}

## Requirements
${reqLines.join("\n")}

## Plan
<!-- To be filled after SPEC approval -->

## Tasks
<!-- To be filled after plan approval -->

## Decisions
<!-- Decisions logged during implementation -->

## Verification
<!-- Verification results after implementation -->

## Completed
<!-- Date and time when marked complete: HH:MM (24-hour format) -->
`
}

/**
 * Update SPEC index
 */
async function updateSPECIndex(projectRoot: string, specId: string, feature: string): Promise<void> {
  const fs = await import("node:fs/promises")
  const path = await import("node:path")

  const indexPath = path.join(projectRoot, ".opencode/SPEC-INDEX.md")

  const indexEntry = `| SPEC-${specId} | ${feature} | draft | 1 | ${new Date().toISOString().split("T")[0]} |\n`

  try {
    let indexContent = await fs.readFile(indexPath, "utf-8")

    // Add entry to table
    if (indexContent.includes("| SPEC-")) {
      indexContent = indexContent.replace(/(\| SPEC-.*\n)/, `$1${indexEntry}`)
    } else {
      // Create table if doesn't exist
      indexContent = `# SPEC Index

| ID | Feature | Status | Iteration | Last Updated |
|----|---------|--------|-----------|--------------|
${indexEntry}`
    }

    await fs.writeFile(indexPath, indexContent, "utf-8")
  } catch {
    // Create index file
    const indexContent = `# SPEC Index

| ID | Feature | Status | Iteration | Last Updated |
|----|---------|--------|-----------|--------------|
${indexEntry}`

    await fs.writeFile(indexPath, indexContent, "utf-8")
  }
}
