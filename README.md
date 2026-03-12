# opencode-symbolic-executor

SPEC-driven development for OpenCode with hash-anchored edits and lazy MCP tool loading.

## What It Does

- **SPEC-driven workflow**: Create requirements → implement → verify (no vague prompts)
- **Hash-anchored edits**: LINE#ID format prevents stale line errors (6.7% → 68.3% success rate)
- **Lazy tool loading**: Catalog builds on session start, tools load on-demand (85% context reduction)
- **Three modes**: Plan (SPEC creation), Build (implementation), Chat (casual questions)
- **Task rules**: Agent creates tasks for itself only—no "confirm" or "test" tasks for users

## Install

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-symbolic-executor"]
}
```

OpenCode auto-installs on startup.

## Configure MCP Servers

### Global (all projects)

Edit `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "serena": {
      "command": ["uvx", "--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"],
      "enabled": true,
      "type": "local"
    },
    "context7": {
      "command": ["npx", "-y", "@context7/mcp-server"],
      "enabled": true,
      "type": "local"
    }
  }
}
```

### Per-project (overrides global)

Create `.opencode/config.json` in project root:

```json
{
  "mcpServers": {
    "sanity": {
      "command": ["npx", "-y", "@sanity/mcp-server"],
      "deferLoading": true
    }
  }
}
```

Global MCPs load for all projects. Local MCPs override per-project.

## Usage

### Create a SPEC

```
Create a SPEC for user authentication with OAuth
```

Agent creates SPEC with requirements, file structure, and tasks.

### Implement

```
Proceed with implementation
```

Agent switches to Build mode and implements per SPEC requirements.

### Hash-Anchored Edits

Files are read with LINE#ID tags:

```
1#AB|function hello() {
2#CD|  return "world"
3#EF|}
```

Edits reference `1#AB` instead of line numbers. Hash validation catches stale references before file corruption.

## Modes

**Plan**: SPEC creation, requirements gathering  
**Build**: Implementation, verification gates  
**Chat**: Casual questions, no SPEC overhead

Mode detection is automatic based on your messages. Use `/mode plan` or `/mode build` to override.

## Slash Commands

- `/symb_init` - Initialize project with .opencode structure
- `/memories` - Search past solutions (aliases: `/memory`, `/mem`)
- `/mode plan|build|chat` - Force mode switch

## Catalog

Tool catalog builds automatically on session start. No manual command needed.

Tools from global MCPs are available everywhere. Tools from local MCPs are project-specific.

## License

MIT
