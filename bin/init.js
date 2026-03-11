#!/usr/bin/env node

/**
 * Project Initialization Command
 * 
 * Creates .opencode/ structure in current directory.
 * Only runs if:
 * - In project root (has package.json or .git)
 * - .opencode/ doesn't already exist
 * 
 * Creates:
 * - .opencode/config.json (MCP servers with deferLoading)
 * - .opencode/constitution.md (project principles)
 * - .opencode/SPEC-INDEX.md (SPEC tracker)
 * - .opencode/specs/ (individual SPECs)
 * - .opencode/mistakes/ (mistake index)
 * - .opencode/decisions/ (decision logs)
 * 
 * Does NOT create:
 * - Sample SPECs (users create their own)
 * - Sample mistakes (users log their own)
 * - Sample decisions (users document their own)
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

// Template paths
const PLUGIN_DIR = path.join(os.homedir(), '.config/opencode/plugins/symbolic-executor')
const TEMPLATES_DIR = path.join(PLUGIN_DIR, '.opencode/templates')

// Templates
const CONSTITUTION_TEMPLATE = `# Project Constitution

## Principles

1. **SPEC-Driven Development**
   - No implementation without approved SPEC
   - All requirements must be testable
   - Decisions documented with traceability

2. **Code Quality**
   - TypeScript strict mode
   - Zero ESLint warnings
   - LSP errors block completion

3. **Security**
   - No secrets in code
   - CVE scanning before merge
   - Input validation required

4. **Verification**
   - Visual verification ≥90%
   - All acceptance criteria met
   - Human-in-the-loop confirmation

## Architecture Boundaries

<!-- Define project layers and dependencies -->

## Code Style

<!-- Define coding conventions -->

## Verification Gates

- Type Safety: 0 TypeScript errors
- Linting: 0 ESLint warnings
- Security: 0 critical CVEs
- Visual: ≥90% match to goal
- SPEC: All acceptance criteria met
`

const SPEC_INDEX_TEMPLATE = `# SPEC Index

| ID | Feature | Status | Iteration | Last Updated |
|----|---------|--------|-----------|--------------|

## Active SPECs

## Archived SPECs
`

async function init() {
  const cwd = process.cwd()
  
  console.log('🚀 Symbolic Executor Project Init\n')
  
  // Check if in project root
  const hasPackage = fs.existsSync(path.join(cwd, 'package.json'))
  const hasGit = fs.existsSync(path.join(cwd, '.git'))
  
  if (!hasPackage && !hasGit) {
    console.error('✗ Error: Not in project root')
    console.error('  Project root must have package.json or .git')
    console.error('  Current directory:', cwd)
    process.exit(1)
  }
  
  console.log('✓ Project root detected')
  
  // Check if .opencode/ already exists
  const opencodeDir = path.join(cwd, '.opencode')
  if (fs.existsSync(opencodeDir)) {
    console.log('✓ .opencode/ already exists')
    console.log('  Skipping initialization')
    return
  }
  
  // Check if plugin is installed
  if (!fs.existsSync(PLUGIN_DIR)) {
    console.error('✗ Error: Plugin not installed')
    console.error('  Install first: git clone https://github.com/zaghloulme/opencode-symbolic-executor.git ~/.config/opencode/plugins/symbolic-executor')
    process.exit(1)
  }
  
  console.log('✓ Plugin installed')
  
  // Create structure
  console.log('\n📁 Creating .opencode/ structure...')
  
  await fs.promises.mkdir(opencodeDir, { recursive: true })
  await fs.promises.mkdir(path.join(opencodeDir, 'specs'), { recursive: true })
  await fs.promises.mkdir(path.join(opencodeDir, 'mistakes'), { recursive: true })
  await fs.promises.mkdir(path.join(opencodeDir, 'decisions'), { recursive: true })
  
  console.log('  - .opencode/specs/')
  console.log('  - .opencode/mistakes/')
  console.log('  - .opencode/decisions/')
  
  // Copy config template
  const configTemplate = path.join(TEMPLATES_DIR, 'config.json')
  if (fs.existsSync(configTemplate)) {
    await fs.promises.copyFile(
      configTemplate,
      path.join(opencodeDir, 'config.json')
    )
    console.log('  - .opencode/config.json')
  } else {
    // Create minimal config if template missing
    await fs.promises.writeFile(
      path.join(opencodeDir, 'config.json'),
      JSON.stringify({
        mcpServers: {
          serena: {
            command: 'uvx --from git+https://github.com/oraios/serena serena start-mcp-server',
            deferLoading: false,
          },
          context7: {
            command: 'npx -y @context7/mcp-server',
            deferLoading: true,
            triggers: ['library', 'package', 'API', 'docs'],
          },
        },
      }, null, 2)
    )
    console.log('  - .opencode/config.json (minimal)')
  }
  
  // Create constitution
  await fs.promises.writeFile(
    path.join(opencodeDir, 'constitution.md'),
    CONSTITUTION_TEMPLATE
  )
  console.log('  - .opencode/constitution.md')
  
  // Create SPEC index
  await fs.promises.writeFile(
    path.join(opencodeDir, 'SPEC-INDEX.md'),
    SPEC_INDEX_TEMPLATE
  )
  console.log('  - .opencode/SPEC-INDEX.md')
  
  console.log('\n✅ Project initialization complete!\n')
  console.log('Next steps:')
  console.log('1. Edit .opencode/constitution.md (define project principles)')
  console.log('2. Edit .opencode/config.json (add your MCP servers)')
  console.log('3. Start OpenCode: opencode')
  console.log('4. Create first SPEC: "Create a SPEC for user authentication"')
}

init()
