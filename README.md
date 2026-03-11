# Symbolic Executor Plugin for OpenCode

A unified plugin that brings SPEC-driven development, intelligent tool search, and verification gates to OpenCode.

## Features

### 🎯 SPEC-Driven Development
- **Living specifications** with iteration tracking
- **Objective scoring** (≥85 to pass) with auto-revision
- **Decision logging** with full traceability
- **Mistake tracking** to get unstuck faster

### 🔍 Intelligent Tool Search
- **BM25 search** for natural language queries ("find symbol definitions")
- **Regex search** for precise queries ("serena_.*symbol")
- **85% context reduction** (77K → 8.7K tokens)
- **Project-specific MCPs** with auto-loading on triggers

### ✅ Verification Gates
- **Type safety**: 0 TypeScript errors
- **Linting**: 0 ESLint warnings
- **Security**: 0 critical CVEs
- **Visual**: ≥90% match to goal description
- **SPEC alignment**: All acceptance criteria met

### 🧠 Executor Mindset
- **No assumptions** - asks when unclear
- **No time estimates** - executes, doesn't schedule
- **No delegation** - main agent handles all coding
- **Full traceability** - sources cited for all decisions

## Installation

### For Humans (Agent-Driven)

**Paste this into your LLM agent:**

```
Install symbolic-executor for OpenCode:
https://raw.githubusercontent.com/zaghloulme/opencode-symbolic-executor/refs/heads/main/scripts/install-for-agent.md
```

Your agent will fetch the installation guide and execute all steps automatically.

---

### Manual Installation (Not Recommended)

If you prefer manual installation:

```bash
# Clone to global plugins directory
mkdir -p ~/.config/opencode/plugins
git clone https://github.com/zaghloulme/opencode-symbolic-executor.git ~/.config/opencode/plugins/symbolic-executor
cd ~/.config/opencode/plugins/symbolic-executor

# Install dependencies
bun install

# Build
bun run build

# Merge config (creates backup)
node scripts/merge-config.js
```

---

### Project Initialization

After installation, initialize a project:

```bash
# In project directory (must have package.json or .git)
node ~/.config/opencode/plugins/symbolic-executor/bin/init
```

Or let your AI agent run it for you.

This creates:
- `.opencode/config.json` (MCP servers with deferLoading)
- `.opencode/constitution.md` (project principles)
- `.opencode/SPEC-INDEX.md` (SPEC tracker)
- `.opencode/specs/` (individual SPECs)
- `.opencode/mistakes/` (mistake index)
- `.opencode/decisions/` (decision logs)

## Usage

### 1. Create a SPEC

```
Create a SPEC for user authentication with OAuth
```

The plugin will:
1. Generate `SPEC-{id}.md` with requirements
2. Create technical plan
3. Score objectively (must be ≥85)
4. Auto-revise if below threshold
5. Generate task list

### 2. Search for Tools

```
I need to find symbol definitions in the codebase
```

Tool search returns:
```
- serena_find_symbol (score: 0.87)
- serena_find_referencing_symbols (score: 0.72)
```

### 3. Verify Work

```
Verify the login implementation
```

Runs verification gates:
- ✅ LSP: 0 errors
- ✅ Security: 0 critical CVEs
- ✅ Visual: 92% match
- ✅ SPEC: All criteria met

## Configuration

### Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `alwaysLoad` | string[] | `["create_spec", "review_plan", "verify_work"]` | Tools always loaded (not deferred) |
| `enableToolSearch` | boolean | `true` | Enable tool search (saves 85% context) |
| `enableSPECWorkflow` | boolean | `true` | Enforce SPEC before implementation |
| `enableVerification` | boolean | `true` | Run verification gates |
| `visualThreshold` | number | `0.90` | Visual verification threshold (0-1) |
| `maxRevisions` | number | `3` | Max plan revisions before user approval |

### MCP Server Configuration

Edit `.opencode/config.json`:

```json
{
  "mcpServers": {
    "sanity": {
      "command": "npx -y @sanity/mcp-server",
      "deferLoading": true,
      "triggers": ["sanity", "CMS", "content", "schema"],
      "regexPatterns": [".*sanity.*", ".*cms.*"]
    }
  }
}
```

### Trigger Detection

MCPs auto-load when triggers detected:

**Keyword matching:**
- User: "I need to query Sanity CMS"
- Loads: `sanity` MCP

**Regex matching:**
- User: "Show me the sanity_schema type"
- Matches: `.*sanity.*`
- Loads: `sanity` MCP

## Decision Logging

Decisions are logged with traceability:

```markdown
# DEC-001: Use React Query v5

**Context:** SPEC-002 requires optimistic updates (REQ-3.2)

**Chosen:** @tanstack/react-query@5.28.0

**Sources:**
- https://tanstack.com/query/v5/docs/react/guides/optimistic-updates
- Context7: /tanstack/react-query

**Alternatives:**
- SWR: Rejected - no optimistic update primitives
- Redux Toolkit: Rejected - 45KB bundle vs 12KB

**Tradeoffs:** Team learning curve (none familiar with React Query)
```

## Mistake Tracking

Mistakes help you get unstuck:

```markdown
# MISTAKE-2026-001: OAuth redirect loop

**Symptom:** Infinite redirect after Google OAuth callback

**Root Cause:** AUTH_CALLBACK_URL env var missing in production

**How We Got Unstuck:**
1. Checked browser console: "Redirect URI mismatch"
2. Compared .env.local vs production env vars
3. Added AUTH_CALLBACK_URL=https://app.example.com/auth/callback
4. Restarted production server

**Prevention:** SPEC template includes "Environment Variables" checklist
```

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Watch mode
bun run dev

# Test
bun test

# Lint
bun run lint
```

## License

MIT
