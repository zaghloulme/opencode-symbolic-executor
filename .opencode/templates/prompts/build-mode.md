## MODE: BUILD (SPEC Implementation)

**Purpose**: Implement SPEC requirements, verify with gates, log decisions

**Always Loaded Tools**:
- Serena: All code operations
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

**DO**: Modify files, run commands, verify, log decisions
