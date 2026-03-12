# /symb_init - Symbolic Executor Initialization

Creates `.opencode/` structure with SPEC-driven templates for the current project.

## Usage

```
/symb_init          # Initialize project
/symb_init --force  # Force reinitialize (overwrite existing)
```

## What It Creates

```
.opencode/
├── config.json          # MCP servers with deferLoading
├── constitution.md      # Project principles
├── SPEC-INDEX.md        # SPEC tracker
├── tools-catalog.json   # Pre-built tool catalog (auto-generated)
├── prompts/
│   ├── plan-mode.md     # Plan mode system prompt
│   ├── build-mode.md    # Build mode system prompt
│   └── chat-mode.md     # Chat mode system prompt
├── specs/               # Individual SPECs
├── memories/
│   └── index.md         # Memory index
├── mistakes/            # Mistake logs
└── decisions/           # Decision logs
```

## Workflow

1. **Check project root** (has package.json or .git)
2. **Create directories** (.opencode/, specs/, memories/, etc.)
3. **Create config files** (config.json, constitution.md, etc.)
4. **Build tool catalog** (scans MCP servers, extracts metadata)
5. **Show summary** with next steps

## Post-Init Steps

After initialization:

1. Edit `.opencode/constitution.md` (define project principles)
2. Edit `.opencode/config.json` (add your MCP servers)
3. Start OpenCode: `opencode`
4. Create first SPEC: "Create a SPEC for user authentication"

## Workflow Modes

**Plan Mode**: Create SPEC → Add requirements → Validate → Approve  
**Build Mode**: Implement tasks → Verify → Log decisions → Mark complete  
**Chat Mode**: General questions, research, quick fixes

## Commands Available After Init

- `create_spec` - Create new SPEC
- `spec.add_requirement` - Add requirement to SPEC
- `spec.add_task` - Add task to SPEC
- `spec.add_decision` - Log decision
- `spec.mark_complete` - Mark SPEC complete
- `verify_work` - Run verification gates
- `search_memories` - Search project memories
- `tool_search` - Search for available tools
- `/memories` - Quick memory search

## Error Handling

If `.opencode/` already exists:
- Ask for confirmation
- Use `--force` to overwrite

If not in project root:
- Warn user
- Suggest: `git init` or `npm init -y`

## Template Sources

Templates loaded from:
- `~/.config/opencode/plugins/symbolic-executor/.opencode/templates/`
- Or npm package location

---

**Note**: This command is read-only until user confirms. No files modified without approval.
