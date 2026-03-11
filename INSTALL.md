# Installation Guide

## Prerequisites

- Node.js 20+ or Bun 1.0+
- OpenCode installed
- Git

## Step 1: Create Private GitHub Repo

1. Go to https://github.com/new
2. Repository name: `opencode-symbolic-executor`
3. Set to **Private**
4. Don't initialize with README (we already have one)
5. Click "Create repository"

## Step 2: Push to GitHub

```bash
cd /home/main/development/opencode-symbolic-executor

# Update remote URL to your GitHub username
git remote set-url origin https://github.com/YOUR_USERNAME/opencode-symbolic-executor.git

# Push to GitHub
git push -u origin main
```

## Step 3: Install Plugin

### Option A: Local Development

```bash
# In plugin directory
cd opencode-symbolic-executor
bun install
bun run build

# Link globally
bun link

# In your OpenCode config (~/.config/opencode/opencode.json)
{
  "plugins": ["@opencode/symbolic-executor"]
}
```

### Option B: From GitHub (Recommended)

```bash
# In your project directory
git clone https://github.com/YOUR_USERNAME/opencode-symbolic-executor.git .opencode/plugins/symbolic-executor

# Install dependencies
cd .opencode/plugins/symbolic-executor
bun install
bun run build

# Add to OpenCode config
{
  "plugins": ["./.opencode/plugins/symbolic-executor"]
}
```

## Step 4: Configure Project

```bash
# In your project root
mkdir -p .opencode

# Copy config template
cp opencode-symbolic-executor/.opencode/templates/config.json .opencode/config.json

# Edit .opencode/config.json to add your MCP servers
```

## Step 5: Verify Installation

```bash
# Start OpenCode in your project
opencode

# You should see:
# - SPEC workflow tools available
# - Tool search enabled
# - System prompt with executor mindset
```

## Troubleshooting

### Plugin not loading

Check OpenCode logs:
```bash
cat ~/.local/share/opencode/logs/*.log
```

### Tools not available

Rebuild plugin:
```bash
cd opencode-symbolic-executor
bun run build
```

### MCP servers not loading

Verify config:
```bash
cat .opencode/config.json
```

Check MCP server commands work:
```bash
npx -y @context7/mcp-server --help
```

## Next Steps

1. Create your first SPEC: `Create a SPEC for user authentication`
2. Search for tools: `I need to find symbol definitions`
3. Verify work: `Verify the login implementation`

For usage examples, see [README.md](./README.md)
