# Symbolic Executor for OpenCode

**SPEC-driven development workflow with verification gates**

## Installation

### Option 1: GitHub (Recommended)

```bash
# Clone to global plugins
mkdir -p ~/.config/opencode/plugins
git clone https://github.com/zaghloulme/opencode-symbolic-executor.git ~/.config/opencode/plugins/symbolic-executor
cd ~/.config/opencode/plugins/symbolic-executor

# Run init (creates .opencode/ in current project)
symbolic-executor init
```

### Option 2: npm (Plugin WIP)

The plugin is being refactored for the new @opencode-ai/plugin API. Install from GitHub for now.

```bash
npm install -g symbolic-executor  # CLI tools only
symbolic-executor init
```

## What It Does

- **SPEC-Driven Development**: No implementation without approved SPEC
- **Tool Search**: BM25 + Regex search (85% context reduction)
- **Verification Gates**: LSP, security, visual (≥90%), SPEC alignment
- **Decision Logging**: Full traceability with sources
- **Mistake Tracking**: "How we got unstuck" focus

## Usage

### Initialize Project

```bash
cd your-project
symbolic-executor init
```

Creates:
- `.opencode/config.json` (MCP servers with deferLoading)
- `.opencode/constitution.md` (project principles)
- `.opencode/SPEC-INDEX.md` (SPEC tracker)
- `.opencode/specs/` (individual SPECs)
- `.opencode/mistakes/` (mistake index)
- `.opencode/decisions/` (decision logs)

### Create SPEC

In OpenCode:
```
Create a SPEC for user authentication
```

### Search Tools

```
I need to find symbol definitions
```

### Verify Work

```
Verify the login implementation
```

## Configuration

Edit `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["symbolic-executor"]
}
```

## License

MIT
