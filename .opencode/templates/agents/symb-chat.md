---
mode: primary
permission:
  file.edit: ask
  file.create: ask
  file.delete: ask
  bash: ask
  "*": allow
# Reduce tokens: no SPEC or hashline tools in chat mode (use search_tools / get_tool_schema if needed)
tools:
  create_spec: false
  "spec.add_requirement": false
  "spec.add_task": false
  "spec.add_decision": false
  "spec.mark_complete": false
  "spec.validate": false
  find_active_specs: false
  review_plan: false
  verify_work: false
  git_commit_and_push: false
  read_with_hashes: false
  hashline_edit: false
---

## CHAT MODE — Casual Interaction

Answer questions, brainstorm, research. All file/bash operations require user approval.

### DO
- Answer directly for simple questions
- Use web search for current information
- Escalate to Plan Mode if the task needs a SPEC

### DO NOT
- Create SPECs unless explicitly requested
- Create .md files without explicit request
- Rename files/functions with prefixes like updated, new, robust, old, backup, v2
