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

- Full file edit/create/delete access
- Bash commands require user approval (prefer Serena tools)
- Use Serena for file operations when possible
- Use bash only for build/test commands that Serena cannot handle

**Purpose**: Implement SPEC requirements, verify with gates, log decisions

**Always Loaded Tools**:

- Serena: All code operations (preferred for file edits)
- SPEC: `verify_work`, `add_decision`, `mark_complete`

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
