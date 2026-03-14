# opencode-symbolic-executor

SPEC-driven development for OpenCode with hash-anchored edits and token-efficient agent tool sets.

## What It Does

- **SPEC-driven workflow**: Create requirements → implement → verify (no vague prompts)
- **Hash-anchored edits**: LINE#ID format prevents stale line errors (6.7% → 68.3% success rate)
- **Token usage**: Per-agent tool filtering (symb-plan and symb-chat disable unneeded tools to reduce prompt size)
- **Three agents**: symb-plan (read-only), symb-build (full access), symb-chat (ask-first)
- **Task rules**: Agent creates tasks for itself only—no "confirm" or "test" tasks for users

## Agents

The plugin installs three agents and disables OpenCode’s built-in ones so only these show:

### symb-plan (READ-ONLY)

SPEC-driven planning and requirements gathering.

**Permissions**:

- ❌ No file edits, creates, or deletes
- ❌ No bash commands
- ✅ Can create SPECs in `.opencode/specs/`
- ✅ Uses Serena read-only tools

**Use for**: Creating SPECs, analyzing codebase, designing solutions

### spec-build (FULL ACCESS)

SPEC implementation and verification.

**Permissions**:

- ✅ Full file edit/create/delete access
- ⚠️ Bash commands require approval (prefers Serena tools)
- ✅ Uses Serena for file operations
- ✅ Runs build/test commands

**Use for**: Implementing SPEC requirements, verifying with gates

### symb-chat (ASK-FIRST)

Casual conversation, brainstorming, and research.

**Permissions**:

- ⚠️ All file operations require approval
- ⚠️ Bash commands require approval
- ✅ Free to use search/research tools
- ✅ Creates .md documents only when asked

**Use for**: Questions, brainstorming, research, creative tasks

---

Agents are installed to `~/.config/opencode/agents/`. On each session start the plugin:
- **Disables** OpenCode’s built-in primary agents (build, plan, chat) in `~/.config/opencode/opencode.json` via `agent.<name>.disable: true`
- **Overwrites** symb-plan, symb-build, symb-chat from the plugin templates (so you get the latest, including per-agent `tools` for token reduction)
- Sets **default_agent** to `symb-build`
- **Prunes** any other agent files in that directory so only symb-plan, symb-build, symb-chat remain

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
      "command": [
        "uvx",
        "--from",
        "git+https://github.com/oraios/serena",
        "serena",
        "start-mcp-server"
      ],
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

Create `.opencode/config.json` in project root (or set MCP under `mcp` in project `opencode.json` if your config uses that shape):

```json
{
  "mcp": {
    "serena": {
      "type": "local",
      "command": [
        "uvx",
        "--from",
        "git+https://github.com/oraios/serena",
        "serena",
        "start-mcp-server",
        "--context",
        "ide",
        "--project",
        "/absolute/path/to/your/project",
        "--open-web-dashboard",
        "False"
      ],
      "enabled": true
    }
  }
}
```

**Configuration flags explained:**

| Flag                         | Purpose                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| `--context ide`              | Reduces tool duplication for terminal/IDE clients               |
| `--project <path>`           | Auto-activates project at startup (no manual activation needed) |
| `--open-web-dashboard False` | Disables web UI (saves resources in remote dev environments)    |

**Global MCPs** load for all projects. **Local MCPs** (`.opencode/config.json`) override per-project.

### Project Registration

Serena stores project configurations globally in `~/.serena/projects/`. To register a new project:

```bash
uvx --from git+https://github.com/oraios/serena serena project create /path/to/project --index
```

Or use the `serena_activate_project` tool within an OpenCode session.

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

## Agents vs Modes

Switch between agents using the agent selector in OpenChamber:

- **symb-plan**: SPEC creation, requirements gathering (read-only)
- **symb-build**: Implementation, verification gates (full access)
- **symb-chat**: Casual questions, research, creative tasks (ask-first)

Built-in build/plan/chat are disabled automatically. Use the agent selector to switch between the three symb-* agents.

## Slash Commands

- `/symb_init` - Initialize project with .opencode structure
- `/memories` - Search past solutions (aliases: `/memory`, `/mem`)
- `/mode plan|build|chat` - Force mode switch

## Catalog

Tool catalog builds automatically on session start. No manual command needed.

Tools from global MCPs are available everywhere. Tools from local MCPs are project-specific.

## License

MIT
