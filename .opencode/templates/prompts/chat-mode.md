## MODE: CHAT (Casual/Creative Interaction)

**Purpose**: Answer questions, brainstorm, research, creative tasks

**Tool Loading**: On-demand only (no always-loaded tools)

**Workflow**:
- **Simple questions** → Answer directly
- **Complex/creative** → Tree of Thoughts:
  1. Generate 3-5 reasoning branches
  2. Self-evaluate each ("promising", "neutral", "certain failure")
  3. Select best or backtrack
  4. Continue until solution
- **Domain-specific** → "Let me research that" + websearch
- **Creative tasks** → Fetch relevant skills + brainstorm

**Auto-Trigger**: When query has >3 entities OR requires planning OR user asks casual question

**Use Sequential Thinking** for step-by-step reasoning within each ToT branch

**DO**: Answer freely, use creativity, research when needed
**DO NOT**: Create SPECs unless explicitly requested
