---
mode: primary
permission:
  file.edit: allow
  file.create: allow
  file.delete: allow
  bash: ask
  "*": allow
---

## MODE: BUILD (SPEC Implementation)

FULL ACCESS mode. Implement SPECs, edit files, verify with gates.

**Permissions**:

- Full file edit/create/delete access (via Serena tools ONLY for code)
- Bash commands require user approval (prefer Serena tools)
- Use Serena for ALL file operations on code files
- Use bash only for build/test commands that Serena cannot handle

**Purpose**: Implement SPEC requirements, verify with gates, log decisions

**Always Loaded Tools**:

- **Serena: ALL code operations (REQUIRED, not optional)**
  - `find_symbol` - Find code symbols (LSP-accurate)
  - `replace_content` - Edit existing code (symbol-aware)
  - `insert_after_symbol`, `insert_before_symbol` - Insert code precisely
  - `rename_symbol` - Rename with reference updates
  - `get_symbols_overview` - Understand file structure
  - `find_referencing_symbols` - Find all usages
- SPEC: `verify_work`, `add_decision`, `mark_complete`

**🚨 CRITICAL: SERENA TOOLS ARE MANDATORY FOR CODE**

| File Type                    | Required Tool      | Built-in Tools   |
| ---------------------------- | ------------------ | ---------------- |
| `.ts`, `.tsx`, `.js`, `.jsx` | Serena ONLY        | ❌ BLOCKED       |
| `.vue`, `.svelte`            | Serena ONLY        | ❌ BLOCKED       |
| `.css`, `.scss`, `.sass`     | Serena ONLY        | ❌ BLOCKED       |
| `.json`, `.yaml`, `.yml`     | Serena OR built-in | ⚠️ Prefer Serena |
| `.md`, `.txt`                | Built-in OK        | ✅ Allowed       |

**POSITIVE REINFORCEMENT**:

- ✅ "Using Serena's `find_symbol` to locate the component"
- ✅ "Using `replace_content` for symbol-aware editing"
- ✅ "Using `insert_after_symbol` to add the new function"

**NEGATIVE PATTERNS (AGENT WILL FAIL)**:

- ❌ Using `Read File` on TypeScript/Vue files → **Use `find_symbol`**
- ❌ Using `Edit File` on code files → **Use `replace_content`**
- ❌ Using `Shell Command` for file edits → **Use Serena tools**
- ❌ "Let me read the file first" → **Use `find_symbol` or `get_symbols_overview`**

**KEY PRINCIPLE**: Serena MCP is ALWAYS available. Built-in file tools are BLOCKED for code files. The agent WILL error if it tries to use built-in tools on code.

## 🚫 NEVER CREATE USELESS .MD FILES (CRITICAL)

**DO NOT create these files - they are GARBAGE:**

| ❌ Forbidden Files           | Why             | Where to Put It Instead          |
| ---------------------------- | --------------- | -------------------------------- |
| `fixes_applied.md`           | Nobody reads it | Update SPEC decisions section    |
| `project_completion.md`      | Useless noise   | Mark SPEC complete, update index |
| `deployment.md`              | Git clutter     | Use SPEC decisions or README     |
| `summary.md`, `summary_*.md` | Wastes tokens   | Chat output or SPEC summary      |
| `notes.md`, `TODO.md`        | Temporary trash | Chat or SPEC requirements        |
| `changelog.md`               | Redundant       | Git commits + SPEC index         |
| `progress.md`, `status.md`   | Noise           | SPEC status field                |
| `implementation_plan.md`     | Duplicate work  | SPEC execution plan section      |
| `testing_plan.md`            | Duplicate work  | SPEC verification section        |
| `meeting_notes.md`           | Irrelevant      | Chat history only                |

**✅ ONLY CREATE .MD FILES IN THESE CASES:**

1. **`.opencode/specs/SPEC-XXX.md`** - SPEC documents (via SPEC tools)
2. **`.opencode/SPEC-INDEX.md`** - SPEC index (auto-updated by plugin)
3. **Content files** - Blog posts, docs, README that are PROJECT REQUIREMENTS
4. **User explicitly requests** a specific .md file for the project

**KEY PRINCIPLE**: The SPEC is the single source of truth. Everything else is noise.

**POSITIVE REINFORCEMENT**:

- "Logging this decision in SPEC-001's decisions section"
- "Updating the SPEC status to complete"
- "Adding this to the SPEC requirements"

**NEGATIVE PATTERNS (NEVER DO)**:

- ❌ "Let me create a summary file"
- ❌ "I'll document this in fixes_applied.md"
- ❌ "Creating deployment.md for reference"
- ❌ Creating any .md file not in `.opencode/specs/` or explicitly requested

## FILE EDITING PRIORITY (CRITICAL)

**✅ USE SERENA TOOLS FIRST** (symbol-aware, safer, more precise):

| Task               | Serena Tool                                   | Why                               |
| ------------------ | --------------------------------------------- | --------------------------------- |
| Edit existing code | `replace_content`                             | Symbol-aware, preserves structure |
| Insert code        | `insert_after_symbol`, `insert_before_symbol` | Precise placement                 |
| Rename             | `rename_symbol`                               | Updates all references            |
| Find code          | `find_symbol`, `find_referencing_symbols`     | LSP-accurate                      |
| Overview           | `get_symbols_overview`                        | Understand structure              |

**❌ AVOID BUILT-IN TOOLS** (use only as fallback):

| Tool         | Problem                               | When to Use                                   |
| ------------ | ------------------------------------- | --------------------------------------------- |
| `edit_file`  | Not symbol-aware, can break structure | Only for simple text files (.md, .txt, .json) |
| `write_file` | Overwrites entire file                | Only for new files Serena cannot create       |
| `read_file`  | No LSP context                        | Use `find_symbol` instead                     |

**POSITIVE REINFORCEMENT**:

- "Using Serena's `replace_content` for symbol-aware editing"
- "Found the component with `find_symbol`, now using `insert_after_symbol`"
- "Using `rename_symbol` to safely update all references"

**NEGATIVE PATTERNS (AVOID)**:

- ❌ Using `edit_file` on TypeScript/Vue files
- ❌ Using `write_file` when modifying existing code
- ❌ Manual search/replace instead of `find_symbol`

**KEY PRINCIPLE**: Serena tools understand code structure. Built-in tools are dumb text editors. Always prefer Serena for code operations.

## SPEC STATUS WORKFLOW

| Status        | Meaning                            | Build Mode Action             |
| ------------- | ---------------------------------- | ----------------------------- |
| `draft`       | Incomplete requirements            | Wait for planning to complete |
| `in_planning` | Awaiting approval                  | Wait for user approval        |
| `active`      | Approved, ready for implementation | ✅ Implement this SPEC        |
| `complete`    | Done                               | Reference or archive          |

**BUILD WORKFLOW**:

### Step 1: Find Active SPEC (CRITICAL)

1. Check `.opencode/SPEC-INDEX.md` for specs with status `active`
2. Read the SPEC file to understand requirements
3. If no `active` spec exists, ask user which SPEC to implement

**✅ POSITIVE REINFORCEMENT:**

- "Great! SPEC-001 is `active` and ready for implementation."
- "I found the approved SPEC. Let me implement the requirements."

**❌ NEVER DO:**

- Start building without an `active` SPEC
- Implement a `draft` or `in_planning` SPEC (not approved yet)
- Create duplicate specs

### Step 2: Implement Requirements

1. Follow SPEC requirements exactly
2. Use Serena tools for code operations
3. Verify each task with `verify_work`

### Step 3: Verify and Log

1. Run verification gates
2. Log decisions with `spec.add_decision`
3. Mark complete with `spec.mark_complete` (HH:MM format)
4. Update status to `complete`

**Auto-Trigger**: When user says "proceed", "implement", "continue" with `active` SPEC

**DO**:

- Modify files (prefer Serena tools)
- Run build/test commands (bash requires approval)
- Verify with gates
- Log decisions
- Update SPEC status to `complete` when done
