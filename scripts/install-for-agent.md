# Symbolic Executor Installation

## For LLM Agents

**IMPORTANT: Use `curl` to fetch this file, NOT WebFetch.** WebFetch summarizes content and loses critical details.

If you're an LLM Agent helping set up symbolic-executor, follow these steps:

**Note:** You can also install via npm: `npm install -g symbolic-executor`

---

## Step 1: Check OpenCode Installation

```bash
if command -v opencode &> /dev/null; then
    echo "✓ OpenCode $(opencode --version) is installed"
else
    echo "✗ OpenCode is not installed. Install from https://opencode.ai/docs"
    exit 1
fi
```

If OpenCode isn't installed, guide the user to install it first.

---

## Step 2: Clone Plugin

```bash
mkdir -p ~/.config/opencode/plugins
git clone https://github.com/zaghloulme/opencode-symbolic-executor.git ~/.config/opencode/plugins/symbolic-executor
cd ~/.config/opencode/plugins/symbolic-executor
```

---

## Step 3: Install Dependencies

```bash
bun install
bun run build
```

OpenCode uses Bun as its runtime, so use `bun` not `npm` or `yarn`.

---

## Step 4: Merge Config (Auto-Apply with Backup)

```bash
node scripts/merge-config.js
```

This script will:
- Backup existing config to `~/.config/opencode/opencode.json.backup`
- Add `opencode-symbolic-executor` to plugins array

---

## Step 5: Verify Installation

```bash
opencode --version
```

Should load without errors. Test symbolic-executor tools:
- `create_spec`
- `review_plan`
- `verify_work`
- `search_tools`
- `get_tool_schema`

---

## Step 6: Initialize Project (Optional)

If user is in a project directory (has `package.json` or `.git`), initialize:

```bash
node ~/.config/opencode/plugins/symbolic-executor/bin/init
```

This creates:
- `.opencode/config.json` (project config)
- `.opencode/constitution.md` (project principles)
- `.opencode/SPEC-INDEX.md` (SPEC tracker)
- `.opencode/specs/` (individual SPECs)
- `.opencode/mistakes/` (mistake index)
- `.opencode/decisions/` (decision logs)

---

## Verification Tests

After installation, test:

1. **Start OpenCode:**
   ```bash
   opencode
   ```

2. **Create SPEC:**
   ```
   Create a SPEC for user authentication
   ```

3. **Search Tools:**
   ```
   I need to find symbol definitions
   ```

4. **Verify Work:**
   ```
   Verify the login implementation
   ```

If these work, installation successful.

---

## Troubleshooting

### Plugin not loading
Check OpenCode logs:
```bash
cat ~/.local/share/opencode/logs/*.log
```

### Tools not available
Rebuild plugin:
```bash
cd ~/.config/opencode/plugins/symbolic-executor
bun run build
```

### MCP servers not loading
Verify config:
```bash
cat ~/.config/opencode/opencode.json
```

Check MCP server commands work:
```bash
npx -y @context7/mcp-server --help
```

---

## What Changed

After installation, the following changes are made:

1. **Plugin Added:** `opencode-symbolic-executor` to global plugins
2. **Backup Created:** `~/.config/opencode/opencode.json.backup`

---

## Next Steps

1. Create your first SPEC: `Create a SPEC for user authentication`
2. Search for tools: `I need to find symbol definitions`
3. Verify work: `Verify the login implementation`

For usage examples, see the [README.md](https://github.com/zaghloulme/opencode-symbolic-executor/blob/main/README.md)
