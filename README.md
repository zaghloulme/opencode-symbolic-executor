# opencode-symbolic-executor

**SPEC-driven development workflow for OpenCode**

## Installation

### Step 1: Add to OpenCode Config

Edit `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "opencode-symbolic-executor"
  ]
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
- `.opencode/mistakes/` (mistake index)
- `.opencode/decisions/` (decision logs)

## Features

- **SPEC-Driven Development**: No implementation without approved SPEC
- **Tool Search**: BM25 + Regex search (85% context reduction)
- **Verification Gates**: LSP, security, visual (≥90%), SPEC alignment
- **Decision Logging**: Full traceability with sources
- **Mistake Tracking**: "How we got unstuck" focus

## Usage in OpenCode

After installation, these tools are available:

- `create_spec` - Create SPEC with requirements
- `review_plan` - Score plans (≥85 to pass)
- `verify_work` - Run verification gates
- `search_decisions` - Search decision logs
- `search_mistakes` - Search mistake logs
- `tool_search` - Search available tools

### Example

```
Create a SPEC for user authentication with OAuth
```

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

## CI/CD

Automated publishing on git tags:

```bash
# Bump version
npm version patch  # or minor/major

# Push tag (triggers npm publish + GitHub Release)
git push origin main --tags
```

## License

MIT
