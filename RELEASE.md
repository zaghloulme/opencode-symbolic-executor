# Release Process

## Automated Publishing (Recommended)

The CI/CD pipeline automatically publishes to npm when you push a version tag.

### Steps:

1. **Update version in package.json:**
   ```bash
   cd /home/main/development/tools/opencode-symbolic-executor
   
   # Bump version (choose one):
   npm version patch  # 0.1.2 → 0.1.3 (bug fixes)
   npm version minor  # 0.1.2 → 0.2.0 (new features)
   npm version major  # 0.1.2 → 1.0.0 (breaking changes)
   ```

2. **Push the tag:**
   ```bash
   git push origin main --tags
   ```

3. **GitHub Actions will:**
   - Run tests on the code
   - Publish to npm with provenance
   - Create GitHub Release with changelog

4. **Verify publication:**
   - npm: https://www.npmjs.com/package/symbolic-executor
   - GitHub Release: https://github.com/zaghloulme/opencode-symbolic-executor/releases

---

## Manual Publishing

If you need to publish manually:

```bash
cd /home/main/development/tools/opencode-symbolic-executor

# Update version
npm version patch

# Publish
npm publish --access public

# Push to git
git push origin main --tags
```

---

## Development Builds

For testing changes without publishing:

```bash
# Install locally
bun link

# Test CLI
symbolic-executor init

# Unlink when done
bun unlink
```

---

## Version Numbering

Follow semantic versioning (SemVer):

- **MAJOR.MINOR.PATCH**
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

Examples:
- `0.1.0` → Initial release
- `0.1.1` → Bug fix
- `0.2.0` → New feature
- `1.0.0` → Stable release
