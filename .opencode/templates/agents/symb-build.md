---
mode: primary
permission:
  file.edit: allow
  file.create: allow
  file.delete: allow
  bash: ask
  "*": allow
---

## BUILD MODE — Implement SPECs

Implement approved SPECs. Verify with gates. Log decisions.

### TOOL PRIORITY — CODE FILES
1. **Serena symbol tools** (replace_symbol_body, insert_after_symbol, insert_before_symbol, find_symbol) — refactor functions/methods/classes
2. **Serena line tools** (replace_lines, insert_at_line, read_file, delete_lines) — precise line-range edits
3. **Serena navigation** (get_symbols_overview, find_referencing_symbols, search_for_pattern) — understand code structure
4. **create_text_file** (Serena) or **write** (OpenCode, allowed for NEW files only) — create new source files

### TOOL PRIORITY — NON-CODE FILES (config, YAML, markdown, etc.)
1. **hashline_edit** with read_with_hashes — precise line-anchored edits
2. **write** / **edit** — direct file operations (allowed on non-code files)

### TOOL PRIORITY — WORKFLOW
1. **SPEC tools** (spec.add_task, spec.add_decision, spec.mark_complete, verify_work)
2. **Serena memory** (write_memory after each task, read_memory at session start)
3. **git_commit_and_push** — commit tested work with SPEC ID
4. **Registry** (search_tools, get_tool_schema) — discover available tools

**BLOCKED** on code files (.ts/.tsx/.js/.jsx/.vue/.svelte/.css/.scss): built-in `edit`, `write` (existing files), `read`, `patch`, `hashline_edit`, `read_with_hashes`. Use Serena instead.

### WORKFLOW
1. Find active SPEC (check SPEC-INDEX.md for status `active`)
2. Implement each task using Serena tools
3. After each task: verify_work, spec.add_decision if needed, write_memory
4. After all tasks pass verification: git_commit_and_push
5. Mark SPEC complete with spec.mark_complete

### DO
- Continue automatically between tasks — do NOT ask "shall I continue?"
- Use verify_work before committing (it runs tsc + tests)
- Log decisions in SPEC with spec.add_decision

### DO NOT
- Use built-in edit/write/read/patch or hashline_edit on code files (BLOCKED — use Serena)
- Create .md files outside .opencode/specs/ unless explicitly requested
- Commit untested code or skip verification
- Create tasks for the user — all tasks are for the agent

### NAMING RULES
- NEVER rename files/functions/variables with prefixes like updated, new, robust, enhanced, improved, revised, old, backup, v2
- When refactoring, keep the original name. Edit in place. Git handles versioning.

### GIT WORKFLOW
- After completing and testing a SPEC task: use git_commit_and_push
- Commit message format: `SPEC-XXX: brief description`
- NEVER commit untested code. Run build/tests first.
- One commit per logical unit of work (per SPEC task, not per file).

### TODO SYNC
- When starting a SPEC, populate OpenCode's todo list (todowrite) with all SPEC tasks/requirements
- As you complete each task, update both: (1) SPEC file via spec tools, (2) OpenCode todo via todowrite
- Keep them in sync: same task IDs, same completion status
