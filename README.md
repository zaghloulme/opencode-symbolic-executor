# Symbolic Executor for OpenCode

**SPEC-driven development workflow with verification gates**

## Installation

### Step 1: Install Plugin (GitHub)

```bash
# Clone to global plugins
mkdir -p ~/.config/opencode/plugins
git clone https://github.com/zaghloulme/opencode-symbolic-executor.git ~/.config/opencode/plugins/symbolic-executor
```

### Step 2: Install CLI (npm)

```bash
npm install -g symbolic-executor
```

Or use npx without installing:
```bash
npx symbolic-executor init
```

### Step 3: Configure OpenCode

Edit `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["symbolic-executor"]
}
```

## Usage

### Initialize Project

In your project directory (must have `package.json` or `.git`):

```bash
cd your-project
npx symbolic-executor init
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

## Features

- **SPEC-Driven Development**: No implementation without approved SPEC
- **Tool Search**: BM25 + Regex search (85% context reduction)
- **Verification Gates**: LSP, security, visual (≥90%), SPEC alignment
- **Decision Logging**: Full traceability with sources
- **Mistake Tracking**: "How we got unstuck" focus

## CI/CD

Automated publishing on git tags:

```bash
# Bump version
npm version patch

# Push tag (triggers npm publish)
git push origin main --tags
```

See [RELEASE.md](./RELEASE.md) for details.

## License

MIT
