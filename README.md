# opencode-symbolic-executor

**SPEC-driven development workflow for OpenCode with MAKER-inspired reliability**

## Installation

### Step 1: Add to OpenCode Config

Edit `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-symbolic-executor"]
}
```

OpenCode will automatically install the plugin using Bun at startup.

### Step 2: Initialize Project (Optional)

In your project directory (must have `package.json` or `.git`):

```bash
npx opencode-symbolic-executor init
```

This creates:
- `.opencode/config.json` (MCP servers with deferLoading)
- `.opencode/constitution.md` (project principles)
- `.opencode/SPEC-INDEX.md` (SPEC tracker)
- `.opencode/specs/` (individual SPECs)
- `.opencode/memory/` (per-project memory index)
- `.opencode/decisions/` (decision logs)

---

## Core Principles

### 1. Atomic Operations

Each SPEC operation is **stateless and independent**:

- `spec.add_requirement` - Add single requirement
- `spec.add_task` - Add single task
- `spec.add_decision` - Log single decision
- `spec.mark_complete` - Mark SPEC complete with timestamp

**Benefits:**
- Fresh context per operation (no drift)
- Error isolation (1 failure ≠ lost work)
- Log-linear cost scaling (MAKER framework)

### 2. Memory System

Memory helps when you're **stuck**, not to **prevent errors**.

- **Location:** `.opencode/memory/` (per-project, singular)
- **Index:** `.opencode/memory/index.md`
- **Purpose:** Reference library for past solutions
- **NOT** a guardrail or error prevention mechanism

When stuck: Use `search_memories` with keywords

> Preventing errors makes LLMs too careful. Memory is a reference library, not a guardrail.

### 3. Error Detection (Red-Flagging)

Automatic red-flag detection discards outputs with:

- Vague language (maybe, probably, I think, assume, guess)
- Overly long responses (>1500 chars)
- Missing required sections
- Incorrect structure/format

Auto-retries up to **3x** before escalating to user.

### 4. Verification Gates

All gates must pass for work to be marked complete:

| Gate     | Threshold  | Measurement                  |
| -------- | ---------- | ---------------------------- |
| LSP      | 0 errors   | TypeScript/compiler errors   |
| Security | 0 critical | CVE count, unsafe patterns   |
| SPEC     | 100%       | Acceptance criteria met      |
| Visual   | ≥90%       | Lighthouse performance score |

---

## Features

- **SPEC-Driven Development**: No implementation without approved SPEC
- **Atomic Operations**: Stateless, fresh context per operation
- **Per-Project Memory**: Reference library when stuck (not error prevention)
- **Red-Flag Detection**: Automatic error detection + auto-retry
- **Verification Gates**: LSP, security, visual, SPEC alignment
- **Decision Logging**: Full traceability with sources
- **Tool Search**: BM25 + Regex search (85% context reduction)

---

## Usage in OpenCode

### Atomic SPEC Operations

```typescript
// Add a requirement
spec.add_requirement: {
  specId: "SPEC-001",
  actor: "User",
  action: "uploads",
  object: "profile images",
  acceptance: "Files 10KB-5MB, formats .png/.jpg/.webp",
  edgeCases: ["Error if >5MB", "Error if wrong format"],
  verification: "Test with 5MB file (pass), 6MB file (fail)"
}

// Add a task
spec.add_task: {
  specId: "SPEC-001",
  description: "Install file upload library",
  acceptanceCriteria: "Package installed, version ^2.0.0 in package.json",
  verification: "npm list shows installed"
}

// Log a decision
spec.add_decision: {
  specId: "SPEC-001",
  context: "SPEC-001 requires file upload (REQ-3.2)",
  chosen: "uploadthing@5.0.0",
  sources: [
    "https://docs.uploadthing.com/",
    "Context7: /uploadthing/sdk"
  ],
  alternatives: [
    { option: "multer", rejectedReason: "Requires manual S3 integration" },
    { option: "filepond", rejectedReason: "Larger bundle size (45KB vs 12KB)" }
  ],
  tradeoffs: "Learning curve (team unfamiliar with uploadthing)"
}

// Mark SPEC complete
spec.mark_complete: {
  specId: "SPEC-001",
  completedAt: "14:30"  // HH:MM format (24-hour)
}

// Validate SPEC structure
spec.validate: {
  specId: "SPEC-001"
}
// Returns: { passed: boolean, errors: string[] }
```

### Search Tools

```typescript
// Search memories (when stuck)
search_memories: {
  keywords: ["oauth", "redirect"],
  category: "auth",  // optional
  specReference: "SPEC-001"  // optional
}

// Search decisions
search_decisions: {
  keywords: ["file upload", "library"],
  type: "library"  // optional
}

// Search mistakes
search_mistakes: {
  keywords: ["CVE", "dependency"],
  category: "security"  // optional
}

// Search tools
tool_search: {
  query: "find symbol definitions",
  limit: 5,  // optional, default: 5
  useRegex: false  // optional, default: false
}
```

### Example Workflow

```
1. Create SPEC: "Create a SPEC for user authentication with OAuth"
2. Add requirements: spec.add_requirement (atomic operations)
3. Add tasks: spec.add_task (atomic operations)
4. Log decisions: spec.add_decision (as you make them)
5. Implement tasks (using Serena tools)
6. Verify: verify_work (all gates must pass)
7. Complete: spec.mark_complete with timestamp
```

---

## Memory System

### Structure

```
.opencode/memory/
├── index.md              # Searchable index
├── MEM-001-oauth.md      # Individual memories
├── MEM-002-cve.md
└── MEM-003-deploy.md
```

### Index Format (`.opencode/memory/index.md`)

```markdown
# Memory Index

| ID      | Category | Date       | Summary                 | File             |
| ------- | -------- | ---------- | ----------------------- | ---------------- |
| MEM-001 | auth     | 2026-03-10 | OAuth redirect loop fix | MEM-001-oauth.md |
| MEM-002 | security | 2026-03-11 | CVE in dependency X     | MEM-002-cve.md   |
```

### Memory Format (`.opencode/memory/MEM-{id}.md`)

```markdown
# MEM-001: OAuth Redirect Loop

**Category:** auth  
**Date:** 2026-03-10  
**SPEC Reference:** SPEC-001.md

## Problem
Infinite redirect after Google OAuth callback in production

## Root Cause
AUTH_CALLBACK_URL env var missing in production

## Solution
1. Added AUTH_CALLBACK_URL to `.env.production`
2. Updated `src/auth/config.ts` line 23

## Files Changed
- `.env.production` (added AUTH_CALLBACK_URL)
- `src/auth/config.ts` (line 23)

## When Stuck, Check This If...
- Seeing "redirect_uri_mismatch" error
- OAuth works locally but fails in production
- Environment-specific auth failures
```

---

## State Management

Each SPEC maintains state across atomic operations:

### SPECState Interface

```typescript
interface SPECState {
  specId: string;
  status: "draft" | "approved" | "in_progress" | "completed";
  requirements: Requirement[];
  tasks: Task[];
  decisions: Decision[];
  memoriesReferenced: MemoryReference[];
  completedAt?: string;  // HH:MM format (24-hour)
}
```

### Persistence

- **Runtime:** In-memory SPECState object
- **Persistent:** `.opencode/specs/SPEC-{id}.state.json`
- **Embedded:** Summary in SPEC markdown (`## Status` section)

### Statelessness

Each atomic operation receives:
- Current SPECState (serialized)
- Immediate operation to perform
- **NO** chat history
- **NO** previous tool calls

This prevents context drift and enables error isolation.

---

## Configuration

Plugin options in `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-symbolic-executor"],
  "symbolicExecutor": {
    "enableSPECWorkflow": true,
    "enableToolSearch": true,
    "visualThreshold": 0.90,
    "maxRevisions": 3
  }
}
```

### MCP Configuration

In `.opencode/config.json`:

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx --from git+https://github.com/oraios/serena serena start-mcp-server",
      "deferLoading": false
    },
    "context7": {
      "command": "npx -y @context7/mcp-server",
      "deferLoading": true,
      "triggers": ["library", "package", "API", "docs"]
    },
    "nodesecure": {
      "command": "npx -y @nodesecure/cli mcp-server",
      "deferLoading": true,
      "triggers": ["security", "CVE", "audit", "vulnerability"]
    },
    "playwright": {
      "command": "npx -y playwright-mcp-server",
      "deferLoading": true,
      "triggers": ["browser", "screenshot", "visual", "test"]
    }
  }
}
```

---

## CI/CD

Automated publishing on git tags:

```bash
# Bump version
npm version patch  # or minor/major

# Push tag (triggers npm publish + GitHub Release)
git push origin main --tags
```

GitHub Actions will:
- Run tests
- Publish to npm with provenance
- Create GitHub Release

---

## MAKER Framework

This plugin implements principles from the [MAKER paper](https://arxiv.org/abs/2511.09030):

### Maximal Decomposition
- Atomic operations (1 step = 1 tool call)
- Fresh context per operation
- State object is the only memory

### Red-Flagging
- Detect structural anomalies
- Discard + retry (don't fix)
- Auto-retry up to 3x

### Statelessness
- No chat history accumulation
- Each operation sees fresh state
- Prevents context drift

### Cost Scaling
- With maximal decomposition: Θ(s ln s) - log-linear
- With coarse tasks: exponential growth
- Atomic operations enable scaling

---

## License

MIT
