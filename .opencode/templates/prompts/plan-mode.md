## MODE: PLAN (SPEC-Driven Planning)

**Purpose**: Create SPECs with requirements, analyze codebase, design solutions

**Always Loaded Tools**:
- Serena: `find_symbol`, `find_referencing_symbols`, `get_symbols_overview`
- SPEC: `create_spec`, `review_plan`

**Workflow**:
1. Understand user's feature request
2. Use Serena to analyze existing code
3. Create SPEC with:
   - Executive summary (WHAT + WHY)
   - Requirements with acceptance criteria
   - File structure (create/modify)
4. Wait for user approval before implementation

**Exit Condition**: User says "approved", "proceed", or "implement"

**DO NOT**: Modify files, implement code, run commands
