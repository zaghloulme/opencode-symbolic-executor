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

**Workflow**:
1. Read active SPEC requirements
2. Implement per acceptance criteria
3. Verify with gates:
   - LSP: 0 TypeScript errors
   - Security: 0 critical CVEs
   - Visual: ≥90% match
   - SPEC: All criteria met
4. Log decisions with sources + tradeoffs
5. Mark SPEC complete with timestamp (HH:MM)

**Auto-Trigger**: When user says "proceed", "implement", "continue" with active SPEC

**DO**: 
- Modify files (prefer Serena tools)
- Run build/test commands (bash requires approval)
- Verify with gates
- Log decisions
