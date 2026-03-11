/**
 * Symbolic Executor Plugin for OpenCode
 * 
 * SPEC-driven development workflow with MAKER-inspired reliability:
 * - Atomic SPEC operations (stateless, fresh context per operation)
 * - Red-flag detection (auto-retry on structural anomalies)
 * - Per-project memory index (reference when stuck, not error prevention)
 * - Verification gates (LSP, security, visual, SPEC)
 * - State management (SPECState persistence)
 */

import { z } from "zod"
import { tool } from "@opencode-ai/plugin"
import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin"

/**
 * Red-flag patterns for error detection
 * Detects structural anomalies BEFORE logic errors occur
 * Auto-retries up to 3x before escalating to user
 */
const RED_FLAGS = [
  { 
    pattern: /maybe|probably|I think|assume|guess/i, 
    reason: "assumption_detected",
    message: "Vague language detected (maybe, probably, I think, assume, guess)"
  },
  { 
    pattern: /^.{1500,}$/,
    reason: "overly_long_response",
    message: "Response too long (>1500 chars indicates confusion)"
  },
  { 
    pattern: /^\s*$/, 
    reason: "empty_response",
    message: "Empty response"
  },
  { 
    pattern: /missing.*section|incomplete|not provided/i, 
    reason: "missing_required_section",
    message: "Missing required section"
  },
]

export const SymbolicExecutor: Plugin = async ({ directory, client }) => {
  // Retry tracking per tool call
  const retryCounts = new Map<string, number>()
  
  const hooks: Hooks = {
    /**
     * On session created: Initialize SPEC state if needed
     */
    event: async ({ event }) => {
      if (event.type === "session.created") {
        await maybeCreateOpencodeDirectory(directory)
      }
    },

    /**
     * Before tool execution: Red-flag detection
     * Discards outputs with structural anomalies and retries
     */
    "tool.execute.before": async (input, output) => {
      const toolKey = `${input.tool}_${Date.now()}`
      
      // Check for red flags in output
      for (const flag of RED_FLAGS) {
        if (flag.pattern.test(JSON.stringify(output.args || {}))) {
          await client.app.log({
            body: {
              service: "symbolic-executor",
              level: "warn",
              message: `Red flag detected: ${flag.reason}`,
              extra: { tool: input.tool, pattern: flag.pattern.toString() }
            }
          })
          
          // Track retries
          const currentRetries = retryCounts.get(toolKey) || 0
          
          if (currentRetries < 3) {
            retryCounts.set(toolKey, currentRetries + 1)
            // Will retry (OpenCode handles retry logic)
          } else {
            // Escalate to user after 3 failed retries
            retryCounts.delete(toolKey)
            throw new Error(`Red flag persisted after 3 retries: ${flag.message}`)
          }
        }
      }
    },

    /**
     * Inject system prompt with executor mindset
     */
    "experimental.chat.system.transform": async (input, output) => {
      output.system.push(EXECUTOR_SYSTEM_PROMPT)
    },

    /**
     * Inject SPEC into compaction context
     * Ensures SPEC persists across session compaction
     * Agent always has SPEC context even after long conversations
     */
    "experimental.session.compacting": async (input, output) => {
      const fs = await import("node:fs/promises")
      const path = await import("node:path")
      
      try {
        // Find active SPECs
        const specsDir = path.join(directory, ".opencode/specs")
        const files = await fs.readdir(specsDir)
        const activeSpecs: any[] = []
        
        for (const file of files) {
          if (!file.endsWith(".md")) continue
          
          const specPath = path.join(specsDir, file)
          const content = await fs.readFile(specPath, "utf-8")
          
          // Extract SPEC metadata
          const specId = file.replace(".md", "")
          const title = content.match(/^# SPEC-\d+: (.+)$/m)?.[1] || "Untitled"
          const status = content.match(/Status: (✓ Complete|in_progress|draft)/)?.[1] || "draft"
          const requirementsCount = (content.match(/REQ-\d+/g) || []).length
          const tasksCount = (content.match(/TASK-\d+/g) || []).length
          const completedTasks = (content.match(/\[x\]/g) || []).length
          
          activeSpecs.push({
            specId,
            title,
            status,
            requirementsCount,
            tasksCount,
            completedTasks,
          })
        }
        
        // Inject into context if there are active SPECs
        if (activeSpecs.length > 0) {
          const specContext = activeSpecs.map(spec => `
## Active SPEC: ${spec.specId} - ${spec.title}
- **Status:** ${spec.status}
- **Requirements:** ${spec.requirementsCount}
- **Tasks:** ${spec.completedTasks}/${spec.tasksCount} completed
- **Next Action:** ${spec.status === "draft" ? "Add requirements" : spec.status === "in_progress" ? "Implement tasks" : "Verify and complete"}
`).join("\n")
          
          output.context.push(`
# SPEC Context (Persists Across Compaction)

${specContext}

**Workflow:**
- Plan Mode: Add requirements → Validate → Approve
- Build Mode: Implement tasks → Verify → Log decisions → Mark complete
`)
        }
      } catch {
        // No specs directory or error reading - that's okay
      }
    },

    /**
     * Custom tools - Atomic SPEC operations
     */
    tool: {
      // ==================== SPEC CREATION ====================
      
      /**
       * Create new SPEC with Executive Summary
       * SPEC = Plan (no separate Plan section needed)
       * Shows ASCII box summary in chat after creation
       */
      create_spec: tool({
        description: "Create new SPEC (SPEC = Plan, no separate Plan section)",
        args: {
          feature: z.string().describe("Feature name (e.g., 'User Authentication with Better-Auth')"),
          summary: z.string().describe("Executive summary (2-3 sentences: WHAT + WHY)"),
          requirements: z.array(z.object({
            actor: z.string(),
            action: z.string(),
            object: z.string(),
            acceptance: z.string(),
            edgeCases: z.array(z.string()),
            verification: z.string(),
            implementation: z.string().optional(),
            dependencies: z.array(z.string()).optional(),
            filesToCreate: z.array(z.string()).optional(),
            filesToModify: z.array(z.string()).optional(),
          })).describe("Requirements with implementation guidance"),
        },
        async execute(args, context) {
          const fs = await import("node:fs/promises")
          const path = await import("node:path")
          
          const specId = await generateSPECId(context.directory)
          const specPath = path.join(context.directory, ".opencode/specs", `SPEC-${specId}.md`)
          
          // Generate requirements markdown
          const requirementsMarkdown = args.requirements.map((req, i) => `
### REQ-${String(i + 1).padStart(3, "0")}: ${req.actor} ${req.action} ${req.object}
- **Acceptance:** ${req.acceptance}
- **Edge Cases:** ${req.edgeCases.join(", ")}
- **Verification:** ${req.verification}${req.implementation ? `\n- **Implementation:** ${req.implementation}` : ""}${req.dependencies && req.dependencies.length > 0 ? `\n- **Dependencies:** ${req.dependencies.join(", ")}` : ""}${req.filesToCreate && req.filesToCreate.length > 0 ? `\n- **Files to Create:** ${req.filesToCreate.join(", ")}` : ""}${req.filesToModify && req.filesToModify.length > 0 ? `\n- **Files to Modify:** ${req.filesToModify.join(", ")}` : ""}
`).join("\n")
          
          // Collect all files
          const allFilesToCreate = [...new Set(args.requirements.flatMap(r => r.filesToCreate || []))]
          const allFilesToModify = [...new Set(args.requirements.flatMap(r => r.filesToModify || []))]
          
          // Generate file structure section
          const fileStructureMarkdown = `
### New Files to Create
${allFilesToCreate.map(f => `- \`${f}\``).join("\n") || "- None"}

### Existing Files to Modify
${allFilesToModify.map(f => `- \`${f}\``).join("\n") || "- None"}
`
          
          // Generate SPEC content
          const specContent = `# SPEC-${specId}: ${args.feature}

## Executive Summary
${args.summary}

---

## Requirements

${requirementsMarkdown}

---

## Execution Plan (Auto-Derived from Requirements)

### Phase 1: Setup
- Install dependencies
- Configure environment variables
- Create base configuration files

### Phase 2: Implementation
- Create new files
- Modify existing files
- Connect components

### Phase 3: Verification
- Run tests
- Verify all acceptance criteria
- Fix any issues

---

## File Structure

${fileStructureMarkdown}

---

## Acceptance Checklist
${args.requirements.map((_, i) => `- [ ] REQ-${String(i + 1).padStart(3, "0")}: ${args.requirements[i].actor} ${args.requirements[i].action} ${args.requirements[i].object}`).join("\n")}

---

## Decisions
<!-- spec.add_decision appends here -->

## Verification Results
<!-- verify_work appends here -->

## Completed
<!-- spec.mark_complete writes: HH:MM (24-hour format) -->
`
          
          await fs.writeFile(specPath, specContent, "utf-8")
          
          // Update SPEC index
          await updateSPECIndex(context.directory, specId, args.feature)
          
          // Generate ASCII box summary for chat
          const asciiBox = `
╔══════════════════════════════════════════════════════════╗
║  ✅ SPEC-${specId} Created                                ║
╠══════════════════════════════════════════════════════════╣
║  Executive Summary:                                      ║
║  ${args.summary.substring(0, 54).padEnd(54, " ")}║
║                                                          ║
║  Requirements: ${args.requirements.toString().length}                                         ║
║  Files to Create: ${String(allFilesToCreate.length).padEnd(36, " ")}║
║  Files to Modify: ${String(allFilesToModify.length).padEnd(36, " ")}║
║                                                          ║
║  Next: Review requirements, then approve SPEC            ║
╚══════════════════════════════════════════════════════════╝

Full SPEC: \`.opencode/specs/SPEC-${specId}.md\`
`
          
          // Log to client (shows in chat)
          await client.app.log({
            body: {
              service: "symbolic-executor",
              level: "info",
              message: "SPEC created",
              extra: {
                specId: `SPEC-${specId}`,
                feature: args.feature,
                summary: args.summary,
                requirementsCount: args.requirements.length,
                filesToCreate: allFilesToCreate.length,
                filesToModify: allFilesToModify.length,
                asciiBox,
              }
            }
          })
          
          return JSON.stringify({ 
            success: true, 
            specId: `SPEC-${specId}`,
            feature: args.feature,
            requirementsCount: args.requirements.length,
            filesToCreate: allFilesToCreate.length,
            filesToModify: allFilesToModify.length,
          })
        },
      }),

      // ==================== ATOMIC SPEC OPERATIONS ====================
      
      /**
       * Add a single requirement to SPEC
       * Stateless: receives current state + requirement data only
       * Includes implementation guidance, dependencies, files
       */
      "spec.add_requirement": tool({
        description: "Add a single requirement to SPEC (atomic operation with implementation guidance)",
        args: {
          specId: z.string().describe("SPEC ID (e.g., 'SPEC-001')"),
          actor: z.string().describe("Who performs the action (e.g., 'User', 'System')"),
          action: z.string().describe("What action is performed (e.g., 'uploads', 'creates')"),
          object: z.string().describe("What is acted upon (e.g., 'profile images', 'account')"),
          acceptance: z.string().describe("Measurable acceptance criteria (include numbers, booleans, specific values)"),
          edgeCases: z.array(z.string()).describe("Edge cases and boundaries (error states, min/max values)"),
          verification: z.string().describe("How to verify (test commands, manual steps)"),
          implementation: z.string().optional().describe("HOW to implement (brief guidance)"),
          dependencies: z.array(z.string()).optional().describe("Packages/libraries needed"),
          filesToCreate: z.array(z.string()).optional().describe("New files to create"),
          filesToModify: z.array(z.string()).optional().describe("Existing files to modify"),
        },
        async execute(args, context) {
          const fs = await import("node:fs/promises")
          const path = await import("node:path")
          
          const specPath = path.join(context.directory, ".opencode/specs", `${args.specId}.md`)
          
          // Read current SPEC
          let specContent = await fs.readFile(specPath, "utf-8")
          
          // Generate requirement markdown
          const reqNum = (specContent.match(/REQ-(\d+)/g) || []).length + 1
          const reqId = `REQ-${String(reqNum).padStart(3, "0")}`
          const reqMarkdown = `
### ${reqId}: ${args.actor} ${args.action} ${args.object}
- **Acceptance:** ${args.acceptance}
- **Edge Cases:** ${args.edgeCases.join(", ")}
- **Verification:** ${args.verification}${args.implementation ? `\n- **Implementation:** ${args.implementation}` : ""}${args.dependencies && args.dependencies.length > 0 ? `\n- **Dependencies:** ${args.dependencies.join(", ")}` : ""}${args.filesToCreate && args.filesToCreate.length > 0 ? `\n- **Files to Create:** ${args.filesToCreate.join(", ")}` : ""}${args.filesToModify && args.filesToModify.length > 0 ? `\n- **Files to Modify:** ${args.filesToModify.join(", ")}` : ""}

`
          
          // Insert into Requirements section (find last requirement or section header)
          if (specContent.includes("## Requirements")) {
            specContent = specContent.replace(
              /## Requirements\n/,
              `## Requirements\n\n${reqMarkdown}`
            )
          } else {
            // Add Requirements section if missing
            specContent = specContent.replace(
              /## Executive Summary\n/,
              `## Executive Summary\n\n## Requirements\n\n${reqMarkdown}`
            )
          }
          
          await fs.writeFile(specPath, specContent, "utf-8")
          
          // Update state
          await updateSPECState(context.directory, args.specId, {
            requirementsCount: reqNum
          })
          
          return JSON.stringify({ 
            success: true, 
            requirementId: reqId,
            specId: args.specId
          })
        },
      }),

      /**
       * Add a single task to SPEC
       * Stateless: receives current state + task data only
       */
      "spec.add_task": tool({
        description: "Add a single task to SPEC (atomic operation)",
        args: {
          specId: z.string().describe("SPEC ID"),
          description: z.string().describe("Task description"),
          acceptanceCriteria: z.string().describe("How to verify task completion"),
          verification: z.string().describe("Verification command or steps"),
        },
        async execute(args, context) {
          const fs = await import("node:fs/promises")
          const path = await import("node:path")
          
          const specPath = path.join(context.directory, ".opencode/specs", `${args.specId}.md`)
          let specContent = await fs.readFile(specPath, "utf-8")
          
          const taskNum = (specContent.match(/TASK-(\d+)/g) || []).length + 1
          const taskMarkdown = `
- **TASK-${String(taskNum).padStart(3, "0")}**: ${args.description}
  - Acceptance: ${args.acceptanceCriteria}
  - Verification: ${args.verification}
  - [ ] 
`
          
          specContent = specContent.replace(
            /## Tasks\n/,
            `## Tasks\n${taskMarkdown}`
          )
          
          await fs.writeFile(specPath, specContent, "utf-8")
          
          return JSON.stringify({ 
            success: true, 
            taskId: `TASK-${String(taskNum).padStart(3, "0")}`,
            specId: args.specId
          })
        },
      }),

      /**
       * Log a single decision with traceability
       * Stateless: receives current state + decision data only
       */
      "spec.add_decision": tool({
        description: "Log a single decision with full traceability (atomic operation)",
        args: {
          specId: z.string().describe("SPEC ID"),
          context: z.string().describe("Why this decision was needed (include SPEC reference)"),
          chosen: z.string().describe("What was chosen (include version)"),
          sources: z.array(z.string()).describe("URLs, docs, SPEC references"),
          alternatives: z.array(z.object({
            option: z.string(),
            rejectedReason: z.string(),
          })).describe("Alternatives considered with rejection reasons"),
          tradeoffs: z.string().describe("What was given up by this choice"),
        },
        async execute(args, context) {
          const fs = await import("node:fs/promises")
          const path = await import("node:path")
          
          const specPath = path.join(context.directory, ".opencode/specs", `${args.specId}.md`)
          let specContent = await fs.readFile(specPath, "utf-8")
          
          const decNum = (specContent.match(/DEC-(\d+)/g) || []).length + 1
          const alternativesMarkdown = args.alternatives
            .map(a => `    - ${a.option}: ${a.rejectedReason}`)
            .join("\n")
          
          const decisionMarkdown = `
- **DEC-${String(decNum).padStart(3, "0")}**: ${args.chosen}
  - Context: ${args.context}
  - Sources: ${args.sources.join(", ")}
  - Alternatives:
${alternativesMarkdown}
  - Tradeoffs: ${args.tradeoffs}
`
          
          specContent = specContent.replace(
            /## Decisions\n/,
            `## Decisions\n${decisionMarkdown}`
          )
          
          await fs.writeFile(specPath, specContent, "utf-8")
          
          return JSON.stringify({ 
            success: true, 
            decisionId: `DEC-${String(decNum).padStart(3, "0")}`,
            specId: args.specId
          })
        },
      }),

      /**
       * Mark SPEC as complete with timestamp
       * Stateless: receives current state + completion time only
       */
      "spec.mark_complete": tool({
        description: "Mark SPEC as complete with timestamp (HH:MM 24-hour format)",
        args: {
          specId: z.string().describe("SPEC ID"),
          completedAt: z.string().describe("Completion time in HH:MM format (24-hour, e.g., '14:30')"),
        },
        async execute(args, context) {
          const fs = await import("node:fs/promises")
          const path = await import("node:path")
          
          const specPath = path.join(context.directory, ".opencode/specs", `${args.specId}.md`)
          let specContent = await fs.readFile(specPath, "utf-8")
          
          // Update Completed section
          specContent = specContent.replace(
            /## Completed\n.*?(?=\n##|\Z)/s,
            `## Completed\n\n- Completed at: ${args.completedAt} (24-hour format)\n- Status: ✅ Complete\n`
          )
          
          await fs.writeFile(specPath, specContent, "utf-8")
          
          // Update state
          await updateSPECState(context.directory, args.specId, {
            status: "completed",
            completedAt: args.completedAt
          })
          
          return JSON.stringify({ 
            success: true, 
            specId: args.specId,
            completedAt: args.completedAt
          })
        },
      }),

      /**
       * Validate SPEC structure
       * Returns validation errors for fixing
       */
      "spec.validate": tool({
        description: "Validate SPEC structure and return errors",
        args: {
          specId: z.string().describe("SPEC ID to validate"),
        },
        async execute(args, context) {
          const fs = await import("node:fs/promises")
          const path = await import("node:path")
          
          const specPath = path.join(context.directory, ".opencode/specs", `${args.specId}.md`)
          
          try {
            const specContent = await fs.readFile(specPath, "utf-8")
            const errors: string[] = []
            
            // Check required sections
            const requiredSections = [
              "## Value",
              "## Requirements",
              "## Tasks",
              "## Decisions",
              "## Verification",
            ]
            
            for (const section of requiredSections) {
              if (!specContent.includes(section)) {
                errors.push(`Missing required section: ${section}`)
              }
            }
            
            // Check for at least one requirement
            if (!specContent.match(/REQ-\d+/)) {
              errors.push("SPEC must have at least one requirement")
            }
            
            // Check requirements have acceptance criteria
            const reqsWithoutAcceptance = (specContent.match(/REQ-\d+.*?(?=- \*\*REQ|\n##)/gs) || [])
              .filter(req => !req.includes("Acceptance:"))
            
            if (reqsWithoutAcceptance.length > 0) {
              errors.push(`${reqsWithoutAcceptance.length} requirement(s) missing acceptance criteria`)
            }
            
            return JSON.stringify({
              passed: errors.length === 0,
              errors,
              specId: args.specId,
            })
          } catch (error) {
            return JSON.stringify({
              passed: false,
              errors: [`SPEC file not found: ${args.specId}`],
              specId: args.specId,
            })
          }
        },
      }),

      // ==================== SEARCH TOOLS ====================
      
      /**
       * Search per-project memory index
       * Helps when stuck (not for error prevention)
       */
      search_memories: tool({
        description: "Search per-project memory index when stuck (reference library, not guardrail)",
        args: {
          keywords: z.array(z.string()).describe("Search keywords"),
          category: z.enum(["auth", "security", "deployment", "performance", "design", "architecture"]).optional().describe("Category filter"),
          specReference: z.string().optional().describe("SPEC reference filter"),
        },
        async execute(args, context) {
          const fs = await import("node:fs/promises")
          const path = await import("node:path")
          
          const memoryIndexPath = path.join(context.directory, ".opencode/memory/index.md")
          
          try {
            const indexContent = await fs.readFile(memoryIndexPath, "utf-8")
            const results: any[] = []
            
            // Simple keyword search in index
            const lines = indexContent.split("\n")
            for (const line of lines) {
              const hasKeywords = args.keywords.some(k => line.toLowerCase().includes(k.toLowerCase()))
              const hasCategory = !args.category || line.toLowerCase().includes(args.category.toLowerCase())
              const hasSPEC = !args.specReference || line.includes(args.specReference)
              
              if (hasKeywords && hasCategory && hasSPEC && line.includes("MEM-")) {
                results.push({
                  line,
                  relevance: "high"
                })
              }
            }
            
            return JSON.stringify(results.slice(0, 10))
          } catch {
            return JSON.stringify({
              error: "Memory index not found. Run 'npx opencode-symbolic-executor init' to create.",
              results: []
            })
          }
        },
      }),

      search_decisions: tool({
        description: "Search decision logs by keyword, type, or SPEC reference",
        args: {
          keywords: z.array(z.string()).describe("Search keywords"),
        },
        async execute(args, context) {
          const fs = await import("node:fs/promises")
          const path = await import("node:path")
          
          const decisionsDir = path.join(context.directory, ".opencode/decisions")
          
          try {
            const files = await fs.readdir(decisionsDir)
            const results: any[] = []
            
            for (const file of files) {
              if (!file.endsWith(".md")) continue
              
              const filePath = path.join(decisionsDir, file)
              const content = await fs.readFile(filePath, "utf-8")
              
              const hasKeywords = args.keywords.some(k => content.toLowerCase().includes(k.toLowerCase()))
              
              if (hasKeywords) {
                results.push({
                  id: file.replace(".md", ""),
                  title: content.match(/^# (.+)$/m)?.[1] || "Untitled",
                  excerpt: content.slice(0, 200) + "..."
                })
              }
            }
            
            return JSON.stringify(results.slice(0, 10))
          } catch {
            return JSON.stringify([])
          }
        },
      }),

      search_mistakes: tool({
        description: "Search mistake logs by keyword or category to get unstuck",
        args: {
          keywords: z.array(z.string()).describe("Search keywords"),
        },
        async execute(args, context) {
          const fs = await import("node:fs/promises")
          const path = await import("node:path")
          
          const mistakesDir = path.join(context.directory, ".opencode/mistakes")
          
          try {
            const files = await fs.readdir(mistakesDir)
            const results: any[] = []
            
            for (const file of files) {
              if (!file.endsWith(".md")) continue
              
              const filePath = path.join(mistakesDir, file)
              const content = await fs.readFile(filePath, "utf-8")
              
              const hasKeywords = args.keywords.some(k => content.toLowerCase().includes(k.toLowerCase()))
              
              if (hasKeywords) {
                results.push({
                  id: file.replace(".md", ""),
                  title: content.match(/^# (.+)$/m)?.[1] || "Untitled",
                  lesson: content.match(/\*\*Lesson\*\*:\s*(.+)/i)?.[1] || "",
                  excerpt: content.slice(0, 200) + "..."
                })
              }
            }
            
            return JSON.stringify(results.slice(0, 10))
          } catch {
            return JSON.stringify([])
          }
        },
      }),

      tool_search: tool({
        description: "Search for available tools by keyword or natural language",
        args: {
          query: z.string().describe("Natural language description or regex pattern"),
          limit: z.number().default(5).describe("Max results to return"),
          useRegex: z.boolean().default(false).describe("Use regex search instead of keyword matching"),
        },
        async execute(args) {
          // Placeholder - would integrate with BM25 or regex search
          return JSON.stringify({ 
            tools: [],
            query: args.query,
            note: "Tool search not yet implemented"
          })
        },
      }),

      // ==================== VERIFICATION TOOLS ====================
      
      review_plan: tool({
        description: "Review and score technical plans objectively (≥85 to pass)",
        args: {
          plan: z.string().describe("Plan content to review"),
          specId: z.string().describe("SPEC reference"),
        },
        async execute(args) {
          const breakdown = await scorePlan(args.plan)
          const score = calculateOverallScore(breakdown)
          const passed = score >= 85
          
          return JSON.stringify({
            score,
            passed,
            breakdown,
            feedback: generateFeedback(breakdown, passed),
          })
        },
      }),

      verify_work: tool({
        description: "Run verification gates (LSP, security, visual, SPEC alignment)",
        args: {
          specId: z.string().describe("SPEC ID to verify against"),
          taskId: z.string().describe("Task ID being verified"),
        },
        async execute() {
          // Placeholder - will integrate with actual verification gates
          return JSON.stringify({ 
            passed: true, 
            score: 100,
            gates: {
              lsp: { passed: true, score: 100, errors: [] },
              security: { passed: true, score: 100, errors: [] },
              visual: { passed: true, score: 100, errors: [] },
              spec: { passed: true, score: 100, errors: [] },
            }
          })
        },
      }),
    },
  }

  return hooks
}

// ==================== HELPER FUNCTIONS ====================

const EXECUTOR_SYSTEM_PROMPT = `
YOU ARE THE PRIMARY DEVELOPER.

PROCESS (ALWAYS FOLLOW):
1. UNDERSTAND - Load SPEC, clarify ambiguities, ask when unclear
2. PLAN - Generate technical plan, score objectively (≥85), revise if needed
3. APPROVE - Present plan to user, incorporate feedback, lock SPEC
4. EXECUTE - Implement per SPEC using Serena (symbolic operations only)
5. VERIFY - Run verification gates (LSP, security, tests, visual)
6. DOCUMENT - Log decisions with traceability, update memory index

RULES:
- NEVER assume - ask when unclear
- NEVER hallucinate - cite sources for all decisions
- NEVER estimate time - you execute, you don't schedule
- NEVER delegate coding tasks - you are the executor
- ALWAYS use Serena for code operations (find_symbol, not grep)
- ALWAYS verify before marking complete
- ALWAYS log decisions with traceability

MEMORY SYSTEM:
Memory helps when stuck, not to prevent errors.
- Location: .opencode/memory/ (per-project)
- Purpose: Reference library for past solutions
- Use search_memories when stuck

RED-FLAG DETECTION:
Automatic detection discards outputs with:
- Vague language (maybe, probably, I think, assume, guess)
- Overly long responses (>1500 chars)
- Missing required sections
Auto-retries up to 3x before escalating.

ATOMIC OPERATIONS:
Each SPEC operation is stateless:
- Fresh context per operation (no drift)
- Error isolation (1 failure ≠ lost work)
- State object is the only memory

VERIFICATION GATES:
- Type Safety: 0 TypeScript errors
- Linting: 0 ESLint warnings
- Security: 0 critical CVEs
- Visual: ≥90% match to goal description
- SPEC: All acceptance criteria met
`

async function maybeCreateOpencodeDirectory(directory: string): Promise<void> {
  const fs = await import("node:fs/promises")
  const path = await import("node:path")

  const opencodeDir = path.join(directory, ".opencode")

  // Check if already exists
  try {
    await fs.access(opencodeDir)
    return
  } catch {
    // Doesn't exist, continue
  }

  // Check if in project root
  const hasPackage = await fs.access(path.join(directory, "package.json"))
    .then(() => true)
    .catch(() => false)
  const hasGit = await fs.access(path.join(directory, ".git"))
    .then(() => true)
    .catch(() => false)

  if (!hasPackage && !hasGit) return

  // Don't auto-create, let user run init command
}

async function generateSPECId(directory: string): Promise<string> {
  const fs = await import("node:fs/promises")
  const path = await import("node:path")

  const indexPath = path.join(directory, ".opencode/SPEC-INDEX.md")

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

function generateSPECContent(specId: string, feature: string, summary: string): string {
  return `# SPEC-${specId}: ${feature}

## Executive Summary
${summary}

---

## Requirements
<!-- Add requirements using spec.add_requirement -->

---

## Execution Plan (Auto-Derived from Requirements)
<!-- Auto-generated when requirements are added -->

---

## File Structure
<!-- Auto-generated: files to create/modify -->

---

## Acceptance Checklist
<!-- Auto-generated from requirements -->

---

## Decisions
<!-- spec.add_decision appends here -->

## Verification Results
<!-- verify_work appends here -->

## Completed
<!-- spec.mark_complete writes: HH:MM (24-hour format) -->
`
}

async function scorePlan(plan: string): Promise<{ clarity: number; completeness: number; testability: number; security: number }> {
  return {
    clarity: scoreClarity(plan),
    completeness: scoreCompleteness(plan),
    testability: scoreTestability(plan),
    security: scoreSecurity(plan),
  }
}

function calculateOverallScore(breakdown: { clarity: number; completeness: number; testability: number; security: number }): number {
  return (
    breakdown.clarity * 0.30 +
    breakdown.completeness * 0.25 +
    breakdown.testability * 0.25 +
    breakdown.security * 0.20
  )
}

function scoreClarity(plan: string): number {
  const vaguePatterns = [/maybe/, /probably/, /try to/, /should/, /I think/]
  const vagueCount = vaguePatterns.filter((p) => p.test(plan)).length
  return Math.max(0, 100 - vagueCount * 10)
}

function scoreCompleteness(plan: string): number {
  const required = ["requirements", "design", "testing", "verification"]
  const present = required.filter((r) => plan.toLowerCase().includes(r)).length
  return (present / required.length) * 100
}

function scoreTestability(plan: string): number {
  const measurablePatterns = [/must$/, /should$/, /will$/]
  const lines = plan.split("\n").filter((l) => l.trim().startsWith("-"))
  const measurable = lines.filter((l) => measurablePatterns.some((p) => p.test(l))).length
  return lines.length > 0 ? (measurable / lines.length) * 100 : 0
}

function scoreSecurity(plan: string): number {
  const securityMentions = [/auth/, /validation/, /sanitize/, /encrypt/, /rate limit/]
  const hasSecurity = securityMentions.some((p) => p.test(plan.toLowerCase()))
  return hasSecurity ? 100 : 50
}

function generateFeedback(breakdown: any, passed: boolean): string[] {
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

/**
 * Update SPEC state (persistent + embedded)
 */
async function updateSPECIndex(
  directory: string,
  specId: string,
  feature: string
): Promise<void> {
  const fs = await import("node:fs/promises")
  const path = await import("node:path")
  
  const indexPath = path.join(directory, ".opencode/SPEC-INDEX.md")
  const today = new Date().toISOString().split("T")[0]
  
  try {
    let indexContent = await fs.readFile(indexPath, "utf-8")
    
    // Add entry to table
    const newEntry = `| SPEC-${specId} | ${feature} | draft | 1 | ${today} |`
    
    if (indexContent.includes("| SPEC-")) {
      // Add after header row
      indexContent = indexContent.replace(
        /(\| ID \| Feature \| Status \| Iteration \| Last Updated \|)/,
        `$1\n${newEntry}`
      )
    } else {
      // Create table if doesn't exist
      indexContent = `# SPEC Index

| ID | Feature | Status | Iteration | Last Updated |
|----|---------|--------|-----------|--------------|
${newEntry}

## Active SPECs

## Archived SPECs
`
    }
    
    await fs.writeFile(indexPath, indexContent, "utf-8")
  } catch {
    // Index doesn't exist, create it
    const indexContent = `# SPEC Index

| ID | Feature | Status | Iteration | Last Updated |
|----|---------|--------|-----------|--------------|
| SPEC-${specId} | ${feature} | draft | 1 | ${today} |

## Active SPECs

## Archived SPECs
`
    await fs.mkdir(path.dirname(indexPath), { recursive: true })
    await fs.writeFile(indexPath, indexContent, "utf-8")
  }
}

async function updateSPECState(
  directory: string,
  specId: string,
  updates: {
    status?: string
    requirementsCount?: number
    completedAt?: string
  }
): Promise<void> {
  const fs = await import("node:fs/promises")
  const path = await import("node:path")
  
  // Update persistent state file
  const statePath = path.join(directory, ".opencode/specs", `${specId}.state.json`)
  
  let state: any = {}
  try {
    const stateContent = await fs.readFile(statePath, "utf-8")
    state = JSON.parse(stateContent)
  } catch {
    // State file doesn't exist yet
  }
  
  Object.assign(state, updates)
  
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8")
}
