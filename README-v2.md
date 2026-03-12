# opencode-symbolic-executor v2.0

## What Changed

### 1. Lazy MCP Tool Loading (Anthropic Pattern)

**Problem**: 42k tokens loaded at session start (all MCP tools)

**Solution**: Runtime tool discovery with `tool_search`

- **Catalog Builder**: Pre-builds metadata catalog at boot (`.opencode/tools-catalog.json`)
- **Search Engine**: BM25 (natural language) + Regex (pattern matching)
- **Response Format**: Full tool definitions with examples (Anthropic pattern)
- **Context Reduction**: 42k → ~5k tokens (85%+ reduction)

**Usage**:
```typescript
// Natural language search
tool_search({ query: "OAuth authentication", limit: 5 })

// Regex search
tool_search({ query: "/screenshot|browser/", useRegex: true })
```

**Files**:
- `src/catalog/types.ts` - Type definitions
- `src/catalog/builder.ts` - Catalog generation (reads config, NO server spawning)
- `src/catalog/bm25.ts` - BM25 scoring algorithm (k1=0.9, b=0.4)
- `src/catalog/search.ts` - Search engine (regex + BM25)
- `src/utils/mcp-client.ts` - MCP communication (for future on-demand loading)
- `bin/build-catalog.js` - CLI command

---

### 2. Mode System (Plan/Build/Chat)

**Plan Mode** (READ-ONLY):
- Create SPECs with requirements
- Research and design
- NO file modifications
- Trigger: "create a SPEC", "plan how to", "design"

**Build Mode** (IMPLEMENTATION):
- Implement approved SPECs
- Verify after each task (LSP, lint, security, visual)
- Log decisions with traceability
- Trigger: "proceed", "implement", "based on the SPEC"

**Chat Mode** (CASUAL):
- General questions, research, quick fixes
- No SPEC overhead
- Tree of Thought for creative tasks
- Sequential Thinking for structured analysis
- Default mode

**Auto-Detection**:
- Analyzes user messages for intent
- Switches modes automatically
- Shows mode notification on switch

**Files**:
- `.opencode/templates/prompts/plan-mode.md`
- `.opencode/templates/prompts/build-mode.md`
- `.opencode/templates/prompts/chat-mode.md`

---

### 3. Slash Commands

**`/symb_init`**:
- Creates `.opencode/` structure
- Generates SPEC-driven templates
- Builds tool catalog
- Shows post-init steps

**`/memories`** (aliases: `/memory`, `/mem`):
- Search project memories by keywords
- Returns categorized results with SPEC references
- Helps when stuck (not for error prevention)

**Files**:
- `.opencode/templates/commands/symb-init.md`
- `.opencode/templates/commands/memories.md`

---

### 4. Reasoning Frameworks

**Tree of Thought** (Creative/Complex):
```
Imagine 3 experts discussing:
- Expert 1: [perspective 1]
- Expert 2: [perspective 2]
- Expert 3: [perspective 3]
All share reasoning, evaluate collectively, reach consensus.
```

**Sequential Thinking** (Multi-step):
- Numbered thoughts (N of M)
- Track and revise when needed
- Branch to explore alternatives
- Integrates with mcp-server-sequentialthinking

**Research Protocol**:
- Say "I don't know, let me look that up"
- Delegate to `@general` for complex research
- Use `@explore` for codebase search
- Web search for current info
- Synthesize findings with sources

---

## Installation

```bash
# Install plugin
npm install -g opencode-symbolic-executor

# Initialize project
/symb_init

# Or via CLI
npx opencode-symbolic-executor init
```

---

## Configuration

### MCP Servers (`.opencode/config.json`)

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx -y @context7/mcp-server",
      "deferLoading": true,
      "triggers": ["library", "package", "API", "docs"],
      "regexPatterns": [".*library.*", ".*package.*"]
    }
  },
  "toolSearch": {
    "alwaysLoad": ["create_spec", "review_plan", "verify_work"],
    "enableToolSearch": true,
    "bm25Params": {
      "k1": 0.9,
      "b": 0.4
    }
  }
}
```

### Mode Prompts

Customize mode behavior in:
- `.opencode/templates/prompts/plan-mode.md`
- `.opencode/templates/prompts/build-mode.md`
- `.opencode/templates/prompts/chat-mode.md`

---

## Workflow Example

### 1. Initialize
```
/symb_init
```

### 2. Create SPEC (Plan Mode)
```
User: Create a SPEC for user authentication with Better-Auth

Agent: [Creates SPEC-001 with requirements]
╔══════════════════════════════════════════════════════════╗
║  ✅ SPEC-001 Created                                     ║
╠══════════════════════════════════════════════════════════╣
║  Executive Summary:                                      ║
║  User authentication with Better-Auth library            ║
║                                                          ║
║  Requirements: 5                                         ║
║  Files to Create: 8                                      ║
║  Files to Modify: 3                                      ║
║                                                          ║
║  Next: Review requirements, then approve SPEC            ║
╚══════════════════════════════════════════════════════════╝
```

### 3. Implement (Build Mode)
```
User: Proceed with implementation

Agent: [Auto-switches to Build Mode]
🔧 Switching to Build Mode (SPEC-001 implementation)

[Implements REQ-001 → Verifies → Logs decision]
[Implements REQ-002 → Verifies → Logs decision]
...
✅ SPEC-001 Complete at 14:30
```

### 4. Quick Question (Chat Mode)
```
User: How does OAuth flow work?

Agent: [Stays in Chat Mode]
[Direct explanation with diagram]
[Links to OAuth spec]
```

---

## Verification Gates

All gates must pass before marking SPEC complete:

| Gate     | Threshold          | Tool                          |
| -------- | ------------------ | ----------------------------- |
| LSP      | 0 TypeScript errors | `tsc --noEmit`                |
| Lint     | 0 ESLint warnings  | `eslint .`                    |
| Security | 0 critical CVEs    | `nodesecure scan`             |
| Visual   | ≥90% match         | `lighthouse`                  |
| SPEC     | All criteria met   | Manual + `verify_work`        |

---

## Decision Logging

Every decision logged with:
- **Context**: Why this decision was needed
- **Chosen**: What was selected (with version)
- **Sources**: URLs, docs, SPEC references
- **Alternatives**: Options considered + rejection reasons
- **Tradeoffs**: What was given up

Example:
```markdown
- **DEC-001**: Better-Auth v1.2.0
  - Context: REQ-001 needs auth library
  - Sources: https://better-auth.com, SPEC-001.md
  - Alternatives:
    - NextAuth: Less flexible for custom flows
    - Auth.js: More complex setup
  - Tradeoffs: Newer library, smaller community
```

---

## Memory System

**Purpose**: Reference library for past solutions (not error prevention)

**Location**: `.opencode/memories/`

**Usage**:
```
/memories OAuth          # Search memories
/mem auth redirect       # Shorthand search
```

**Format**:
```markdown
# MEM-001: OAuth Redirect Loop

**Category:** auth
**Date:** 2026-03-10
**SPEC Reference:** SPEC-001.md

## Problem
Infinite redirect after Google OAuth callback

## Root Cause
AUTH_CALLBACK_URL env var missing

## Solution
1. Added to `.env.production`
2. Updated `src/auth/config.ts` line 23

## When Stuck, Check This If...
- Seeing "redirect_uri_mismatch"
- OAuth works locally but fails in production
```

---

## Performance

| Metric                  | Before    | After     | Change    |
| ----------------------- | --------- | --------- | --------- |
| Session startup tokens  | 42,000    | ~5,000    | -88%      |
| Tool search latency     | N/A       | <100ms    | Fast      |
| Catalog build time      | N/A       | ~3-5s     | One-time  |
| Mode switch latency     | N/A       | <50ms     | Instant   |

---

## Architecture

```
opencode-symbolic-executor/
├── src/
│   ├── index.ts              # Main plugin, mode detection
│   ├── catalog/
│   │   ├── types.ts          # Type definitions
│   │   ├── builder.ts        # Catalog generation
│   │   ├── bm25.ts           # BM25 scoring
│   │   └── search.ts         # Search engine
│   └── utils/
│       └── mcp-client.ts     # MCP communication
├── bin/
│   ├── init.js               # Init command
│   └── build-catalog.js      # Catalog build command
└── .opencode/templates/
    ├── config.json           # MCP server config template
    ├── prompts/
    │   ├── plan-mode.md
    │   ├── build-mode.md
    │   └── chat-mode.md
    ├── commands/
    │   ├── symb-init.md
    │   └── memories.md
    └── constitution.md       # Project principles
```

---

## Migration Guide

### From v1.0 to v2.0

1. **Backup existing SPECs**:
   ```bash
   cp -r .opencode/specs .opencode/specs.backup
   ```

2. **Update plugin**:
   ```bash
   npm install -g opencode-symbolic-executor@2
   ```

3. **Reinitialize**:
   ```bash
   /symb_init --force
   ```

4. **Restore SPECs**:
   ```bash
   cp .opencode/specs.backup/*.md .opencode/specs/
   ```

5. **Update MCP config**:
   - Add `deferLoading: true` to all MCP servers
   - Add `toolSearch` section

---

## Troubleshooting

### Catalog build fails
```bash
# Check logs
cat ~/.config/opencode/logs/catalog-build-*.log

# Force rebuild
npx opencode-build-catalog --force
```

### Mode not switching
- Check `.opencode/templates/prompts/` exists
- Verify mode trigger keywords in message
- Restart opencode session

### Tool search returns empty
- Ensure catalog built: `npx opencode-build-catalog`
- Check MCP config in `.opencode/config.json`
- Verify MCP servers are accessible

---

## Contributing

1. Fork repo
2. Create branch: `git checkout -b feature/your-feature`
3. Implement with SPEC-driven workflow
4. Run verification gates
5. Submit PR

---

## License

MIT
