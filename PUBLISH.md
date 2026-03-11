# Publishing to npm

## Current Status

- ✅ GitHub repository is public: https://github.com/zaghloulme/opencode-symbolic-executor
- ⏳ npm publish requires authentication

## Steps to Publish

### 1. Login to npm

```bash
cd /home/main/development/tools/opencode-symbolic-executor
npm adduser
```

This will prompt for:
- Username: zaghloulme
- Password: [your npm password]
- Email: [your email]

Or use token:
```bash
npm login --auth-type=legacy
```

### 2. Publish

```bash
npm publish --access public
```

### 3. Verify

```bash
npm view symbolic-executor
```

Should show package info.

## Post-Publish Installation

After publishing, users can install with:

```bash
# Global install
npm install -g symbolic-executor

# Or let OpenCode auto-install from package.json
```

## Update Global Config

After npm publish, update `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["symbolic-executor"]
}
```

OpenCode will auto-install from npm.

## Troubleshooting

### Package name already exists
Choose a different name or use scoped package:
```bash
npm publish --scope zaghloulme
```

### Authentication failed
Create npm token:
1. Go to https://www.npmjs.com/settings/zaghloulme/tokens
2. Create new token (Read/Write)
3. Add to ~/.npmrc:
   ```
   //registry.npmjs.org/:_authToken=YOUR_TOKEN_HERE
   ```

### Version already exists
Increment version:
```bash
npm version patch  # 0.1.0 → 0.1.1
npm publish --access public
```
