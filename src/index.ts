/**
 * Symbolic Executor Plugin for OpenCode
 * 
 * A unified plugin that provides:
 * - SPEC-driven development workflow (BMAD + SPEC-KIT synthesis)
 * - Tool search with BM25 + Regex (Anthropic pattern)
 * - Serena-based symbolic code operations
 * - Verification gates with visual testing
 * - Decision logging and mistake tracking
 * 
 * @packageDocumentation
 */

import { type Plugin, tool } from "@opencode-ai/plugin"
import type { OpencodeClient } from "./utils/client-types"
import { ToolCatalog } from "./catalog/tool-catalog"
import { createSpecTool } from "./tools/create-spec"
import { reviewPlanTool } from "./tools/review-plan"
import { verifyWorkTool } from "./tools/verify-work"
import { searchDecisionsTool } from "./tools/search-decisions"
import { searchMistakesTool } from "./tools/search-mistakes"
import { toolSearchTool } from "./tools/tool-search"
import { specWorkflow } from "./spec/workflow-engine"
import { clarityEnforcer } from "./utils/clarity-enforcer"
import { executorMindset } from "./utils/executor-mindset"

export interface SymbolicExecutorConfig {
  /**
   * Tools always loaded into context (not deferred)
   * Recommended: core tools used in every session
   */
  alwaysLoad?: string[]
  
  /**
   * Enable tool search (default: true)
   * When enabled, tools are deferred and discovered on-demand
   */
  enableToolSearch?: boolean
  
  /**
   * Enable SPEC workflow enforcement (default: true)
   * Blocks implementation until SPEC is approved
   */
  enableSPECWorkflow?: boolean
  
  /**
   * Enable verification gates (default: true)
   * Runs automated checks before marking tasks complete
   */
  enableVerification?: boolean
  
  /**
   * Visual verification threshold (0-1, default: 0.90)
   * Screenshots must score >= this to pass
   */
  visualThreshold?: number
  
  /**
   * Auto-revision limit (default: 3)
   * Max plan revisions before requiring user approval
   */
  maxRevisions?: number
}

/**
 * Default configuration for Symbolic Executor
 * 
 * These defaults prioritize:
 * - Context efficiency (tool search enabled)
 * - Quality gates (SPEC workflow + verification)
 * - Clarity (no assumptions, full traceability)
 */
const DEFAULT_CONFIG: Required<SymbolicExecutorConfig> = {
  alwaysLoad: ["create_spec", "review_plan", "verify_work"],
  enableToolSearch: true,
  enableSPECWorkflow: true,
  enableVerification: true,
  visualThreshold: 0.90,
  maxRevisions: 3,
}

/**
 * Symbolic Executor Plugin
 * 
 * Main entry point for the plugin. Initializes:
 * 1. Tool catalog with BM25 + Regex search
 * 2. SPEC workflow engine
 * 3. Verification gates
 * 4. Clarity enforcer (no assumptions)
 * 5. Executor mindset (no time estimates)
 * 
 * @example
 * ```typescript
 * // ~/.config/opencode/opencode.json
 * {
 *   "plugins": ["symbolic-executor"],
 *   "symbolicExecutor": {
 *     "alwaysLoad": ["create_spec", "verify_work"],
 *     "enableToolSearch": true,
 *     "visualThreshold": 0.90
 *   }
 * }
 * ```
 */
export const SymbolicExecutor: Plugin<SymbolicExecutorConfig> = async ({
  project,
  client,
  directory,
  worktree,
  config,
}) => {
  // Merge user config with defaults
  const cfg: Required<SymbolicExecutorConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  }

  // Initialize tool catalog
  const catalog = new ToolCatalog({
    alwaysLoad: cfg.alwaysLoad,
    enableSearch: cfg.enableToolSearch,
  })

  // Register all tools
  await registerTools(catalog, client, project, cfg)

  // Initialize workflow engine
  const workflow = specWorkflow(client, project, cfg)

  return {
    /**
     * Custom tools provided by this plugin
     * 
     * These tools are always available (not deferred)
     */
    tools: {
      // SPEC workflow tools
      create_spec: createSpecTool(client, project, catalog),
      review_plan: reviewPlanTool(client, project, cfg),
      verify_work: verifyWorkTool(client, project, cfg),

      // Search tools
      search_decisions: searchDecisionsTool(project),
      search_mistakes: searchMistakesTool(project),
      tool_search: toolSearchTool(catalog),
    },

    /**
     * Event hooks for enforcing workflow
     */
    hooks: {
      /**
       * On session created:
       * - Load project-specific MCPs
       * - Initialize SPEC index
       * - Auto-create .opencode/ if in project root and user wants to implement
       */
      "session.created": async () => {
        await workflow.onSessionCreated()
        await catalog.loadProjectMCPs(project.root)
        await maybeCreateOpencodeDirectory(client, directory)
      },

      /**
       * Before tool execution:
       * - Enforce Serena-only code operations
       * - Validate SPEC alignment
       * - Block assumptions
       */
      "tool.execute.before": async (event) => {
        // Block non-Serena code operations
        if (isCodeOperation(event) && !isSerenaTool(event)) {
          event.deny(
            `USE_SERENA: Prefer find_symbol over grep, insert_after_symbol over edit`
          )
        }

        // Validate against SPEC
        if (cfg.enableSPECWorkflow) {
          await workflow.validateToolExecution(event)
        }
      },

      /**
       * After tool execution:
       * - Log decisions with traceability
       * - Update mistake tracker if relevant
       */
      "tool.execute.after": async (event) => {
        if (event.tool.name === "create_spec" || event.tool.name === "review_plan") {
          await workflow.logDecision(event.result)
        }
      },

      /**
       * On message updated:
       * - Detect assumptions and block execution
       * - Load MCPs on-demand based on triggers
       * - Enforce executor mindset
       */
      "message.updated": async (event) => {
        // Block assumptions
        if (cfg.enableSPECWorkflow) {
          await clarityEnforcer(client, event.message)
        }

        // Load MCPs on-demand
        await catalog.loadMCPOnDemand(event.message.content)

        // Enforce executor mindset
        await executorMindset(client, event.message)
      },

      /**
       * On session compacted:
       * - Preserve decision logs
       * - Maintain SPEC references
       */
      "session.compacted": async () => {
        await workflow.preserveContext()
      },
    },

    /**
     * System prompt injected into all sessions
     * 
     * Defines the executor mindset and process
     */
    systemPrompt: `
YOU ARE THE PRIMARY DEVELOPER.

PROCESS (ALWAYS FOLLOW):
1. UNDERSTAND - Load SPEC, clarify ambiguities, ask when unclear
2. PLAN - Generate technical plan, score objectively (≥85), revise if needed
3. APPROVE - Present plan to user, incorporate feedback, lock SPEC
4. EXECUTE - Implement per SPEC using Serena (symbolic operations only)
5. VERIFY - Run verification gates (LSP, security, tests, visual)
6. DOCUMENT - Log decisions with traceability, update MistakeKeeper

RULES:
- NEVER assume - ask when unclear
- NEVER hallucinate - cite sources for all decisions
- NEVER estimate time - you execute, you don't schedule
- NEVER delegate coding tasks - you are the executor
- ALWAYS use Serena for code operations (find_symbol, not grep)
- ALWAYS verify before marking complete
- ALWAYS log decisions with traceability

TOOLS AVAILABLE:
- create_spec: Create SPEC with requirements
- review_plan: Review and score plans (≥85 to pass)
- verify_work: Run verification gates
- search_decisions: Find past decisions by keyword
- search_mistakes: Find past mistakes by keyword
- tool_search: Search for available tools

DECISION LOGGING:
All decisions MUST include:
- Context: Why this decision was needed
- Sources: URLs, docs, SPEC references
- Alternatives: Options considered + rejection reasons
- Tradeoffs: What was given up

MISTAKE TRACKING:
Mistakes document:
- Symptom: What went wrong (observable)
- Root Cause: Why it happened (systemic, not human error)
- How We Got Unstuck: Specific steps to resolve
- Prevention: Checklist item or gate

VERIFICATION GATES:
- Type Safety: 0 TypeScript errors
- Linting: 0 ESLint warnings
- Security: 0 critical CVEs
- Visual: ≥90% match to goal description
- SPEC: All acceptance criteria met
`,
  }
}

/**
 * Register all tools with the catalog
 * 
 * Tools are categorized as:
 * - global: Always available (Serena, SPEC workflow)
 * - project-mcp: Loaded per-project based on triggers
 * - global-mcp: Available globally but deferred
 */
async function registerTools(
  catalog: ToolCatalog,
  client: OpencodeClient,
  project: any,
  config: Required<SymbolicExecutorConfig>
): Promise<void> {
  // Register core tools (always loaded)
  catalog.register({
    name: "create_spec",
    description: "Create new SPEC with requirements, plan, tasks, and verification criteria",
    category: "global",
    keywords: ["spec", "requirements", "plan", "create", "initialize"],
    deferLoading: false,
  })

  catalog.register({
    name: "review_plan",
    description: "Review and score technical plans objectively (≥85 to pass)",
    category: "global",
    keywords: ["plan", "review", "score", "validate", "approve"],
    deferLoading: false,
  })

  catalog.register({
    name: "verify_work",
    description: "Run verification gates (LSP, security, visual, tests)",
    category: "global",
    keywords: ["verify", "test", "check", "validate", "gate"],
    deferLoading: false,
  })

  // Register search tools
  catalog.register({
    name: "search_decisions",
    description: "Search decision logs by keyword, type, or SPEC reference",
    category: "global",
    keywords: ["search", "decisions", "find", "lookup", "reference"],
    deferLoading: config.enableToolSearch,
  })

  catalog.register({
    name: "search_mistakes",
    description: "Search mistake logs by keyword or category to get unstuck",
    category: "global",
    keywords: ["search", "mistakes", "find", "help", "stuck"],
    deferLoading: config.enableToolSearch,
  })

  // Register tool search itself
  catalog.register({
    name: "tool_search",
    description: "Search for available tools by keyword or natural language",
    category: "global",
    keywords: ["search", "tools", "find", "discover", "catalog"],
    deferLoading: false,
  })

  // Register Serena tools (deferred if tool search enabled)
  const serenaTools = [
    { name: "serena_find_symbol", keywords: ["find", "symbol", "definition", "code"] },
    { name: "serena_find_referencing_symbols", keywords: ["find", "references", "usages", "code"] },
    { name: "serena_get_symbols_overview", keywords: ["overview", "symbols", "file", "structure"] },
    { name: "serena_insert_after_symbol", keywords: ["insert", "add", "code", "after"] },
    { name: "serena_insert_before_symbol", keywords: ["insert", "add", "code", "before"] },
    { name: "serena_replace_symbol_body", keywords: ["replace", "edit", "code", "body"] },
    { name: "serena_rename_symbol", keywords: ["rename", "refactor", "symbol"] },
  ]

  serenaTools.forEach((tool) => {
    catalog.register({
      name: tool.name,
      description: `Serena tool to ${tool.keywords.join(" ")}`,
      category: "global",
      keywords: tool.keywords,
      deferLoading: config.enableToolSearch,
    })
  })
}

/**
 * Check if a tool operation is code-related
 */
function isCodeOperation(event: any): boolean {
  const codePatterns = [/\.ts$/, /\.tsx$/, /\.js$/, /\.py$/, /src\//, /components\//]
  const input = event.tool.input || {}
  const path = input.path || ""
  return codePatterns.some((p) => p.test(path))
}

/**
 * Check if a tool is a Serena tool
 */
function isSerenaTool(event: any): boolean {
  const serenaTools = [
    "find_symbol",
    "find_referencing_symbols",
    "get_symbols_overview",
    "insert_after_symbol",
    "insert_before_symbol",
    "replace_symbol_body",
    "rename_symbol",
    "execute_shell_command",
  ]
  return serenaTools.some((t) => event.tool.name.includes(t))
}

/**
 * Smart detection: Auto-create .opencode/ directory only when appropriate
 * 
 * Creates when:
 * - In project root (has package.json or .git)
 * - User message implies implementation (not questions)
 * - .opencode/ doesn't already exist
 * 
 * Does NOT create when:
 * - User asks questions ("How do I...", "What is...")
 * - User is in non-project directory
 * - .opencode/ already exists
 */
async function maybeCreateOpencodeDirectory(
  client: OpencodeClient,
  directory: string
): Promise<void> {
  const fs = await import("node:fs/promises")
  const path = await import("node:path")
  const os = await import("node:os")

  const opencodeDir = path.join(directory, ".opencode")

  // Check if already exists
  try {
    await fs.access(opencodeDir)
    return // Already exists, skip
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

  if (!hasPackage && !hasGit) {
    return // Not a project root
  }

  // Check if user message implies implementation
  // This is a heuristic - we'd need to get the current message from context
  // For now, we skip auto-creation and let user run init command
  // This avoids creating .opencode/ when user is just asking questions
  return
}

export default SymbolicExecutor
