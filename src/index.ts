import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import type { Hooks, Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { ToolRegistry } from "./dehydrate/registry.js";
import { createDehydratedTools } from "./dehydrate/tools.js";
import { installAgents } from "./helpers/agents.js";
import { calculateOverallScore, generateFeedback, scorePlan } from "./helpers/scoring.js";
import { generateSPECId, updateSPECIndex } from "./helpers/spec-index.js";
import { scanActiveSpecs } from "./helpers/spec-scanner.js";
import { buildContinuationPrompt, detectStallPhrases } from "./helpers/stall-detection.js";
import { EXECUTOR_SYSTEM_PROMPT } from "./helpers/system-prompt.js";

const execFileAsync = promisify(execFile);

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte", ".css", ".scss", ".sass", ".less"];

const BLOCKED_FILE_TOOLS = ["edit", "write", "read", "patch"];

const FORBIDDEN_MD = [
  /fixes_applied.*\.md$/i,
  /project_completion.*\.md$/i,
  /deployment.*\.md$/i,
  /summary.*\.md$/i,
  /notes.*\.md$/i,
  /TODO.*\.md$/i,
  /changelog.*\.md$/i,
  /progress.*\.md$/i,
  /status.*\.md$/i,
  /implementation_plan.*\.md$/i,
  /testing_plan.*\.md$/i,
  /meeting_notes.*\.md$/i,
  /migration_plan.*\.md$/i,
  /setup.*\.md$/i,
  /todo.*\.md$/i,
];

const ALLOWED_MD_PATHS = [".opencode/specs/", ".opencode/SPEC-INDEX.md"];

const LAZY_RENAME_PATH = [
  /(?:updated|robust|enhanced|improved|revised|modified|backup|orig|copy)(?=[A-Z])/,
  /(?:_v\d+|_old|_new|_backup|_copy|_temp|_orig)\./,
];

export const SymbolicExecutor: Plugin = async ({ directory, client }) => {
  const registry = await ToolRegistry.create(path.join(directory, "registry"));
  const dehydratedTools = createDehydratedTools(registry);

  // Stall detection state -- tracks whether agent went idle with pending work
  let stoppedWithPendingWork = false;

  const hooks: Hooks = {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        await maybeCreateOpencodeDirectory(directory);
        await installAgents();
        stoppedWithPendingWork = false;
      }

      // When session goes idle, check for incomplete SPEC tasks
      if (event.type === "session.idle") {
        const activeSpecs = await scanActiveSpecs(directory);
        const hasPendingWork = activeSpecs.some((s) => s.completedTasks < s.tasksCount);
        if (hasPendingWork) {
          stoppedWithPendingWork = true;
          await client.app.log({
            body: {
              service: "symbolic-executor",
              level: "warn",
              message: "Session went idle with unfinished SPEC tasks",
              extra: {
                specs: activeSpecs
                  .filter((s) => s.completedTasks < s.tasksCount)
                  .map((s) => ({
                    specId: s.specId,
                    remaining: s.tasksCount - s.completedTasks,
                  })),
              },
            },
          });
        } else {
          stoppedWithPendingWork = false;
        }
      }
    },

    "tool.execute.before": async (input, output) => {
      const filePath = output.args?.filePath || output.args?.path || "";

      // BLOCK built-in file tools on EXISTING code files (Serena REQUIRED)
      // Allow 'write' on new files -- Serena can't create files from scratch
      const isCodeFile = CODE_EXTENSIONS.some((ext) => filePath.toLowerCase().endsWith(ext));
      if (isCodeFile && BLOCKED_FILE_TOOLS.includes(input.tool)) {
        // Allow 'write' if the file doesn't exist yet (new file creation)
        if (input.tool === "write" && filePath) {
          const fullPath = path.resolve(directory, filePath);
          try {
            await fs.access(fullPath);
            // File exists -- block it, should use Serena
          } catch {
            // File doesn't exist -- allow creation
            return;
          }
        }

        const alternatives: Record<string, string> = {
          edit: "Use Serena replace_content or hashline_edit with read_with_hashes",
          write: "Use Serena replace_content or hashline_edit with read_with_hashes (file already exists)",
          read: "Use read_with_hashes (LINE#ID format) or Serena find_symbol",
          patch: "Use Serena replace_content or hashline_edit with read_with_hashes",
        };
        throw new Error(
          `BLOCKED: Cannot use '${input.tool}' on code file '${filePath}'. ${alternatives[input.tool] || "Use Serena tools."}`,
        );
      }

      // BLOCK bash for file editing and raw git commit/push
      if (input.tool === "bash") {
        const cmd = output.args?.command || "";
        const fileEditPatterns = [/\bsed\s+-i/, /\bawk\b.*>/, /\becho\b.*>>/, /\bcat\b.*>/, /\bprintf\b.*>/];
        const touchesCodeFile = CODE_EXTENSIONS.some((ext) => cmd.includes(ext));
        if (touchesCodeFile && fileEditPatterns.some((p) => p.test(cmd))) {
          throw new Error(
            `BLOCKED: Cannot use bash for file editing on code files. Use Serena tools or hashline_edit workflow.`,
          );
        }
        if (/git\s+(commit|push)\b/i.test(cmd)) {
          throw new Error(
            `BLOCKED: Use git_commit_and_push instead of raw git commit/push. It enforces: verification before commit, SPEC ID in message, auto-push.`,
          );
        }
      }

      // BLOCK useless .md file creation
      if (["write", "edit", "patch"].includes(input.tool)) {
        const isMdFile = filePath.toLowerCase().endsWith(".md");
        const isAllowed = ALLOWED_MD_PATHS.some((p) => filePath.includes(p));
        const isForbidden = FORBIDDEN_MD.some((p) => p.test(filePath));
        if (isMdFile && !isAllowed && isForbidden) {
          throw new Error(
            `BLOCKED: Cannot create '${filePath}'. Useless .md files are forbidden. Document in SPEC instead.`,
          );
        }
      }

      // BLOCK lazy rename patterns in file paths
      if (["write", "edit"].includes(input.tool) && filePath) {
        const basename = filePath.split("/").pop() || "";
        if (LAZY_RENAME_PATH.some((p) => p.test(basename))) {
          throw new Error(
            `BLOCKED: Lazy rename detected in '${basename}'. Keep the original file name -- git handles versioning.`,
          );
        }
      }
    },

    "tool.execute.after": async (input, output) => {
      // Detect stall phrases in tool results that suggest the agent is stopping
      const resultText = typeof output.output === "string" ? output.output : JSON.stringify(output.output || "");
      const stallPhrases = detectStallPhrases(resultText);
      if (stallPhrases.length > 0) {
        const activeSpecs = await scanActiveSpecs(directory);
        const hasPending = activeSpecs.some((s) => s.completedTasks < s.tasksCount);
        if (hasPending) {
          await client.app.log({
            body: {
              service: "symbolic-executor",
              level: "warn",
              message: `Stall phrase detected in ${input.tool} output while tasks are pending`,
              extra: { tool: input.tool, phrases: stallPhrases },
            },
          });
        }
      }
    },

    "experimental.session.compacting": async (_input, output) => {
      const activeSpecs = await scanActiveSpecs(directory);
      if (activeSpecs.length > 0) {
        const specContext = activeSpecs
          .map((s) => `- **${s.specId}** (${s.title}): ${s.status}, ${s.completedTasks}/${s.tasksCount} tasks done`)
          .join("\n");

        const pendingContext =
          activeSpecs.some((s) => s.completedTasks < s.tasksCount)
            ? buildContinuationPrompt(
                activeSpecs.filter((s) => s.completedTasks < s.tasksCount),
                false,
              )
            : "";

        output.context.push(
          `# Active SPECs\n${specContext}\n${pendingContext}\n` +
            `**IMPORTANT**: Call read_memory and list_memories at session start to recall prior context. ` +
            `Call write_memory after completing each SPEC task to persist progress.`,
        );
      }
    },

    "experimental.chat.system.transform": async (_input, output) => {
      const parts = [EXECUTOR_SYSTEM_PROMPT];

      // Check for incomplete SPEC tasks and inject continuation prompt
      const activeSpecs = await scanActiveSpecs(directory);
      const specsWithPending = activeSpecs.filter((s) => s.tasksCount > 0 && s.completedTasks < s.tasksCount);
      if (specsWithPending.length > 0) {
        parts.push(buildContinuationPrompt(specsWithPending, stoppedWithPendingWork));
        // Reset flag after injecting -- it served its purpose for this turn
        stoppedWithPendingWork = false;
      }

      output.system = parts;
    },

    tool: {
      create_spec: tool({
        description: "Create new SPEC. Check find_active_specs first to avoid duplicates.",
        args: {
          feature: z.string().describe("Feature name"),
          summary: z.string().describe("Executive summary (2-3 sentences: WHAT + WHY)"),
          requirements: z
            .array(
              z.object({
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
              }),
            )
            .describe("Requirements with implementation guidance"),
        },
        async execute(args, context) {
          const specId = await generateSPECId(context.directory);
          const specPath = path.join(context.directory, ".opencode/specs", `SPEC-${specId}.md`);

          const requirementsMarkdown = args.requirements
            .map((req, i) => {
              const reqId = `REQ-${String(i + 1).padStart(3, "0")}`;
              let md = `### ${reqId}: ${req.actor} ${req.action} ${req.object}\n- **Acceptance:** ${req.acceptance}\n- **Edge Cases:** ${req.edgeCases.join(", ")}\n- **Verification:** ${req.verification}`;
              if (req.implementation) md += `\n- **Implementation:** ${req.implementation}`;
              if (req.dependencies?.length) md += `\n- **Dependencies:** ${req.dependencies.join(", ")}`;
              if (req.filesToCreate?.length) md += `\n- **Files to Create:** ${req.filesToCreate.join(", ")}`;
              if (req.filesToModify?.length) md += `\n- **Files to Modify:** ${req.filesToModify.join(", ")}`;
              return md;
            })
            .join("\n\n");

          const allFilesToCreate = [...new Set(args.requirements.flatMap((r) => r.filesToCreate || []))];
          const allFilesToModify = [...new Set(args.requirements.flatMap((r) => r.filesToModify || []))];

          const specContent = `# SPEC-${specId}: ${args.feature}

**Status:** draft

## Executive Summary
${args.summary}

---

## Requirements

${requirementsMarkdown}

---

## Tasks
<!-- spec.add_task appends here -->

---

## File Structure

### New Files to Create
${allFilesToCreate.map((f) => `- \`${f}\``).join("\n") || "- None"}

### Existing Files to Modify
${allFilesToModify.map((f) => `- \`${f}\``).join("\n") || "- None"}

---

## Acceptance Checklist
${args.requirements.map((r, i) => `- [ ] REQ-${String(i + 1).padStart(3, "0")}: ${r.actor} ${r.action} ${r.object}`).join("\n")}

---

## Decisions
<!-- spec.add_decision appends here -->

## Verification Results
<!-- verify_work appends here -->

## Completed
<!-- spec.mark_complete writes: HH:MM (24-hour format) -->
`;

          await fs.writeFile(specPath, specContent, "utf-8");
          await updateSPECIndex(context.directory, specId, args.feature);

          const todoSync = args.requirements.map((r, i) => ({
            id: `SPEC-${specId}-REQ-${String(i + 1).padStart(3, "0")}`,
            content: `${r.actor} ${r.action} ${r.object}`,
            status: "pending" as const,
          }));

          return JSON.stringify({
            success: true,
            specId: `SPEC-${specId}`,
            feature: args.feature,
            requirementsCount: args.requirements.length,
            filesToCreate: allFilesToCreate.length,
            filesToModify: allFilesToModify.length,
            todoSync,
          });
        },
      }),

      "spec.add_requirement": tool({
        description: "Add a single requirement to SPEC (atomic operation)",
        args: {
          specId: z.string().describe("SPEC ID (e.g., 'SPEC-001')"),
          actor: z.string(),
          action: z.string(),
          object: z.string(),
          acceptance: z.string().describe("Measurable acceptance criteria"),
          edgeCases: z.array(z.string()),
          verification: z.string(),
          implementation: z.string().optional(),
          dependencies: z.array(z.string()).optional(),
          filesToCreate: z.array(z.string()).optional(),
          filesToModify: z.array(z.string()).optional(),
        },
        async execute(args, context) {
          const specPath = path.join(context.directory, ".opencode/specs", `${args.specId}.md`);
          let specContent = await fs.readFile(specPath, "utf-8");

          const reqNum = (specContent.match(/REQ-(\d+)/g) || []).length + 1;
          const reqId = `REQ-${String(reqNum).padStart(3, "0")}`;
          let reqMarkdown = `\n### ${reqId}: ${args.actor} ${args.action} ${args.object}\n- **Acceptance:** ${args.acceptance}\n- **Edge Cases:** ${args.edgeCases.join(", ")}\n- **Verification:** ${args.verification}`;
          if (args.implementation) reqMarkdown += `\n- **Implementation:** ${args.implementation}`;
          if (args.dependencies?.length) reqMarkdown += `\n- **Dependencies:** ${args.dependencies.join(", ")}`;
          if (args.filesToCreate?.length) reqMarkdown += `\n- **Files to Create:** ${args.filesToCreate.join(", ")}`;
          if (args.filesToModify?.length) reqMarkdown += `\n- **Files to Modify:** ${args.filesToModify.join(", ")}`;
          reqMarkdown += "\n";

          // Append after existing requirements (before the --- separator)
          const reqSectionEnd = specContent.indexOf("\n---", specContent.indexOf("## Requirements"));
          if (reqSectionEnd !== -1) {
            specContent = specContent.slice(0, reqSectionEnd) + reqMarkdown + specContent.slice(reqSectionEnd);
          } else {
            specContent = specContent.replace(/## Requirements\n/, `## Requirements\n${reqMarkdown}`);
          }

          await fs.writeFile(specPath, specContent, "utf-8");
          await updateSPECIndex(context.directory, args.specId, null, reqNum);

          return JSON.stringify({
            success: true,
            requirementId: reqId,
            specId: args.specId,
            todoSync: [
              {
                id: `${args.specId}-${reqId}`,
                content: `${args.actor} ${args.action} ${args.object}`,
                status: "pending",
              },
            ],
          });
        },
      }),

      "spec.add_task": tool({
        description: "Add a single task to SPEC (atomic operation)",
        args: {
          specId: z.string().describe("SPEC ID"),
          description: z.string().describe("Task description"),
          acceptanceCriteria: z.string().describe("How to verify task completion"),
          verification: z.string().describe("Verification command or steps"),
        },
        async execute(args, context) {
          const specPath = path.join(context.directory, ".opencode/specs", `${args.specId}.md`);
          let specContent = await fs.readFile(specPath, "utf-8");

          const taskNum = (specContent.match(/TASK-(\d+)/g) || []).length + 1;
          const taskId = `TASK-${String(taskNum).padStart(3, "0")}`;
          const taskMarkdown = `\n- **${taskId}**: ${args.description}\n  - Acceptance: ${args.acceptanceCriteria}\n  - Verification: ${args.verification}\n  - [ ] \n`;

          if (specContent.includes("## Tasks")) {
            const taskSectionEnd = specContent.indexOf("\n---", specContent.indexOf("## Tasks"));
            if (taskSectionEnd !== -1) {
              specContent = specContent.slice(0, taskSectionEnd) + taskMarkdown + specContent.slice(taskSectionEnd);
            } else {
              specContent = specContent.replace(/## Tasks\n/, `## Tasks\n${taskMarkdown}`);
            }
          } else {
            specContent = specContent.replace(/## Decisions/, `## Tasks\n${taskMarkdown}\n---\n\n## Decisions`);
          }

          await fs.writeFile(specPath, specContent, "utf-8");

          return JSON.stringify({
            success: true,
            taskId,
            specId: args.specId,
            todoSync: [{ id: `${args.specId}-${taskId}`, content: args.description, status: "pending" }],
          });
        },
      }),

      "spec.add_decision": tool({
        description: "Log a single decision with full traceability (atomic operation)",
        args: {
          specId: z.string().describe("SPEC ID"),
          context: z.string().describe("Why this decision was needed"),
          chosen: z.string().describe("What was chosen"),
          sources: z.array(z.string()).describe("URLs, docs, SPEC references"),
          alternatives: z
            .array(
              z.object({
                option: z.string(),
                rejectedReason: z.string(),
              }),
            )
            .describe("Alternatives considered with rejection reasons"),
          tradeoffs: z.string().describe("What was given up by this choice"),
        },
        async execute(args, context) {
          const specPath = path.join(context.directory, ".opencode/specs", `${args.specId}.md`);
          let specContent = await fs.readFile(specPath, "utf-8");

          const decNum = (specContent.match(/DEC-(\d+)/g) || []).length + 1;
          const alternativesMarkdown = args.alternatives
            .map((a) => `    - ${a.option}: ${a.rejectedReason}`)
            .join("\n");

          const decisionMarkdown = `\n- **DEC-${String(decNum).padStart(3, "0")}**: ${args.chosen}\n  - Context: ${args.context}\n  - Sources: ${args.sources.join(", ")}\n  - Alternatives:\n${alternativesMarkdown}\n  - Tradeoffs: ${args.tradeoffs}\n`;

          specContent = specContent.replace(/## Decisions\n/, `## Decisions\n${decisionMarkdown}`);
          await fs.writeFile(specPath, specContent, "utf-8");

          return JSON.stringify({
            success: true,
            decisionId: `DEC-${String(decNum).padStart(3, "0")}`,
            specId: args.specId,
          });
        },
      }),

      "spec.mark_complete": tool({
        description: "Mark SPEC as complete with timestamp (HH:MM 24-hour format)",
        args: {
          specId: z.string().describe("SPEC ID"),
          completedAt: z.string().describe("Completion time in HH:MM format"),
        },
        async execute(args, context) {
          const specPath = path.join(context.directory, ".opencode/specs", `${args.specId}.md`);
          let specContent = await fs.readFile(specPath, "utf-8");

          specContent = specContent.replace(
            /## Completed\n.*?(?=\n##|Z)/s,
            `## Completed\n\n- Completed at: ${args.completedAt} (24-hour format)\n- Status: Complete\n`,
          );
          specContent = specContent.replace(/\*\*Status:\*\* \w+/, `**Status:** complete`);

          await fs.writeFile(specPath, specContent, "utf-8");

          // Update index
          const indexPath = path.join(context.directory, ".opencode/SPEC-INDEX.md");
          try {
            let indexContent = await fs.readFile(indexPath, "utf-8");
            indexContent = indexContent.replace(
              new RegExp(`(\\| ${args.specId} \\|[^|]+\\|)[^|]+(\\|[^|]+\\|[^|]+\\|)`),
              `$1 complete $2`,
            );
            await fs.writeFile(indexPath, indexContent, "utf-8");
          } catch {
            // Index not found
          }

          // Build todoSync with all items marked complete
          const taskMatches = specContent.match(/TASK-\d+/g) || [];
          const reqMatches = specContent.match(/REQ-\d+/g) || [];
          const todoSync = [
            ...reqMatches.map((id) => ({ id: `${args.specId}-${id}`, content: id, status: "completed" as const })),
            ...taskMatches.map((id) => ({ id: `${args.specId}-${id}`, content: id, status: "completed" as const })),
          ];

          return JSON.stringify({
            success: true,
            specId: args.specId,
            completedAt: args.completedAt,
            todoSync,
          });
        },
      }),

      "spec.validate": tool({
        description: "Validate SPEC structure and return errors",
        args: {
          specId: z.string().describe("SPEC ID to validate"),
        },
        async execute(args, context) {
          const specPath = path.join(context.directory, ".opencode/specs", `${args.specId}.md`);

          try {
            const specContent = await fs.readFile(specPath, "utf-8");
            const errors: string[] = [];

            for (const section of ["## Executive Summary", "## Requirements", "## Tasks", "## Decisions"]) {
              if (!specContent.includes(section)) errors.push(`Missing required section: ${section}`);
            }
            if (!specContent.match(/REQ-\d+/)) errors.push("SPEC must have at least one requirement");

            const reqsWithoutAcceptance = (specContent.match(/REQ-\d+.*?(?=- \*\*REQ|\n##)/gs) || []).filter(
              (req) => !req.includes("Acceptance:"),
            );
            if (reqsWithoutAcceptance.length > 0) {
              errors.push(`${reqsWithoutAcceptance.length} requirement(s) missing acceptance criteria`);
            }

            return JSON.stringify({ passed: errors.length === 0, errors, specId: args.specId });
          } catch {
            return JSON.stringify({
              passed: false,
              errors: [`SPEC file not found: ${args.specId}`],
              specId: args.specId,
            });
          }
        },
      }),

      find_active_specs: tool({
        description:
          "Find SPECs with status 'draft', 'in_planning', or 'active'. Use BEFORE create_spec to avoid duplicates!",
        args: {
          statuses: z
            .array(z.enum(["draft", "in_planning", "active"]))
            .optional()
            .default(["draft", "in_planning", "active"]),
        },
        async execute(args, context) {
          const specsDir = path.join(context.directory, ".opencode/specs");
          try {
            const files = await fs.readdir(specsDir);
            const results: {
              specId: string;
              feature: string;
              status: string;
              requirementsCount: number;
              tasksCount: number;
              completedTasks: number;
            }[] = [];

            for (const file of files) {
              if (!file.endsWith(".md")) continue;
              const content = await fs.readFile(path.join(specsDir, file), "utf-8");
              const status =
                content.match(/Status:\s*(draft|in_planning|active|complete)/i)?.[1]?.toLowerCase() || "draft";
              if (!args.statuses.includes(status as "draft" | "in_planning" | "active")) continue;

              results.push({
                specId: file.replace(".md", ""),
                feature: content.match(/^# SPEC-\d+:\s*(.+)$/m)?.[1] || "Untitled",
                status,
                requirementsCount: (content.match(/REQ-\d+/g) || []).length,
                tasksCount: (content.match(/TASK-\d+/g) || []).length,
                completedTasks: (content.match(/\[x\]/g) || []).length,
              });
            }

            return JSON.stringify({
              specs: results,
              count: results.length,
              message:
                results.length > 0
                  ? `Found ${results.length} SPEC(s) in ${args.statuses.join("/")} status`
                  : `No SPECs found. Safe to create new SPEC.`,
            });
          } catch {
            return JSON.stringify({ specs: [], count: 0, hint: "Specs directory may not exist yet." });
          }
        },
      }),

      ...dehydratedTools,

      review_plan: tool({
        description: "Review and score technical plans objectively (≥85 to pass)",
        args: {
          plan: z.string().describe("Plan content to review"),
          specId: z.string().describe("SPEC reference"),
        },
        async execute(args) {
          const breakdown = scorePlan(args.plan);
          const score = calculateOverallScore(breakdown);
          const passed = score >= 85;
          return JSON.stringify({ score, passed, breakdown, feedback: generateFeedback(breakdown, passed) });
        },
      }),

      verify_work: tool({
        description: "Run build/test verification. Returns real pass/fail based on tsc and test output.",
        args: {
          specId: z.string().describe("SPEC ID to verify against"),
          taskId: z.string().describe("Task ID being verified"),
        },
        async execute(_args, context) {
          const results: { gate: string; passed: boolean; output: string }[] = [];

          // TypeScript type check
          try {
            await execFileAsync("npx", ["tsc", "--noEmit"], { cwd: context.directory });
            results.push({ gate: "typecheck", passed: true, output: "No errors" });
          } catch (e: unknown) {
            const err = e as { stdout?: string; stderr?: string };
            results.push({ gate: "typecheck", passed: false, output: (err.stdout || err.stderr || "").slice(0, 500) });
          }

          // Run tests if available
          try {
            const pkgRaw = await fs.readFile(path.join(context.directory, "package.json"), "utf-8");
            const pkg = JSON.parse(pkgRaw);
            if (pkg.scripts?.test) {
              try {
                await execFileAsync("npx", ["vitest", "run", "--reporter=verbose"], {
                  cwd: context.directory,
                  timeout: 60000,
                });
                results.push({ gate: "tests", passed: true, output: "All tests passed" });
              } catch (e: unknown) {
                const err = e as { stdout?: string; stderr?: string };
                results.push({ gate: "tests", passed: false, output: (err.stdout || err.stderr || "").slice(0, 500) });
              }
            }
          } catch {
            // No package.json or no test script
          }

          const allPassed = results.every((r) => r.passed);
          return JSON.stringify({ passed: allPassed, gates: results });
        },
      }),

      git_commit_and_push: tool({
        description:
          "Commit and push tested changes. Runs verification first. Commit message must reference a SPEC ID.",
        args: {
          specId: z.string().describe("SPEC ID (e.g., SPEC-001)"),
          message: z.string().describe("Commit description (will be prefixed with SPEC ID)"),
          files: z.array(z.string()).optional().describe("Files to stage (default: all changed)"),
        },
        async execute(args, context) {
          // 1. Run build verification
          try {
            await execFileAsync("npx", ["tsc", "--noEmit"], { cwd: context.directory });
          } catch (e: unknown) {
            const err = e as { stdout?: string; stderr?: string };
            return JSON.stringify({
              success: false,
              error: "Build verification failed. Fix errors before committing.",
              output: (err.stdout || err.stderr || "").slice(0, 500),
            });
          }

          // 2. Stage files
          const filesToStage = args.files && args.files.length > 0 ? args.files : ["."];
          await execFileAsync("git", ["add", ...filesToStage], { cwd: context.directory });

          // 3. Commit with SPEC-prefixed message
          const commitMessage = `${args.specId}: ${args.message}`;
          try {
            await execFileAsync("git", ["commit", "-m", commitMessage], { cwd: context.directory });
          } catch (e: unknown) {
            const err = e as { stdout?: string; stderr?: string };
            return JSON.stringify({
              success: false,
              error: "Commit failed",
              output: (err.stdout || err.stderr || "").slice(0, 500),
            });
          }

          // 4. Push
          try {
            await execFileAsync("git", ["push"], { cwd: context.directory });
          } catch {
            // Try setting upstream
            try {
              const { stdout: branch } = await execFileAsync("git", ["branch", "--show-current"], {
                cwd: context.directory,
              });
              await execFileAsync("git", ["push", "-u", "origin", branch.trim()], { cwd: context.directory });
            } catch (e: unknown) {
              const err = e as { stdout?: string; stderr?: string };
              return JSON.stringify({
                success: false,
                error: "Push failed",
                output: (err.stdout || err.stderr || "").slice(0, 500),
              });
            }
          }

          // 5. Get commit hash
          const { stdout: commitHash } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], {
            cwd: context.directory,
          });

          return JSON.stringify({
            success: true,
            commit: commitHash.trim(),
            message: commitMessage,
            pushed: true,
          });
        },
      }),

      read_with_hashes: tool({
        description:
          "Read file with LINE#ID format for hashline_edit compatibility. Use BEFORE hashline_edit to get hash anchors.",
        args: {
          filePath: z.string().describe("Path to file (relative to project root)"),
          includeHashPrefix: z.boolean().default(true),
        },
        async execute(args, context) {
          const { formatHashLines } = await import("./tools/hashline/hash-computation.js");
          const fullPath = path.join(context.directory, args.filePath);

          try {
            const content = await fs.readFile(fullPath, "utf-8");
            return JSON.stringify({
              success: true,
              filePath: args.filePath,
              content: args.includeHashPrefix ? formatHashLines(content) : content,
            });
          } catch (error) {
            return JSON.stringify({ success: false, error: (error as Error).message });
          }
        },
      }),

      hashline_edit: tool({
        description: "Edit files using LINE#ID format for precise, safe modifications. Use read_with_hashes first.",
        args: {
          filePath: z.string().describe("Path to file (relative to project root)"),
          edits: z.array(
            z.object({
              op: z.enum(["replace", "append", "prepend"]),
              pos: z.string().optional().describe('LINE#ID anchor (e.g., "11#VK")'),
              end: z.string().optional().describe("LINE#ID end anchor for range operations"),
              lines: z.union([z.string(), z.array(z.string())]).optional(),
            }),
          ),
          delete: z.boolean().optional(),
          rename: z.string().optional(),
        },
        async execute(args, context) {
          const { executeHashlineEdits } = await import("./tools/hashline/executor.js");

          try {
            const fullPath = path.join(context.directory, args.filePath);

            let content: string;
            try {
              content = await fs.readFile(fullPath, "utf-8");
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code === "ENOENT") {
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

            const result = await executeHashlineEdits(content, {
              filePath: args.filePath,
              edits: args.edits,
              delete: args.delete,
              rename: args.rename,
            });

            if (!result.success) return JSON.stringify(result);

            if (args.delete) {
              await fs.unlink(fullPath);
            } else {
              const contentToWrite = result
                .updatedContent!.split("\n")
                .map((line) => line.replace(/^\d+#[ZPMQVRWSNKTXJBYH]{2}\|/, ""))
                .join("\n");

              const writePath = args.rename ? path.join(context.directory, args.rename) : fullPath;
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
            return JSON.stringify({ success: false, error: (error as Error).message });
          }
        },
      }),
    },
  };

  return hooks;
};

async function maybeCreateOpencodeDirectory(directory: string): Promise<void> {
  try {
    await fs.access(path.join(directory, ".opencode"));
    return;
  } catch {
    // Doesn't exist
  }

  const hasPackage = await fs
    .access(path.join(directory, "package.json"))
    .then(() => true)
    .catch(() => false);
  const hasGit = await fs
    .access(path.join(directory, ".git"))
    .then(() => true)
    .catch(() => false);

  if (!hasPackage && !hasGit) return;
  // Don't auto-create, let user run init command
}
