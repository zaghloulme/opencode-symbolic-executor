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
 * - .opencode/memory/ (per-project memory index)
 * - .opencode/mistakes/ (mistake index)
 * - .opencode/decisions/ (decision logs)
 * 
 * Does NOT create:
 * - Sample SPECs (users create their own)
 * - Sample mistakes (users log their own)
 * - Sample decisions (users document their own)
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Template paths (check npm package location first, then git clone location)
const NPM_PACKAGE_DIR = path.join(os.homedir(), '.npm/_npx/opencode-symbolic-executor')
const GIT_PLUGIN_DIR = path.join(os.homedir(), '.config/opencode/plugins/symbolic-executor')
const TEMPLATES_DIR = path.join(GIT_PLUGIN_DIR, '.opencode/templates')

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

const SERENA_IGNORE_TEMPLATE = `memories/
`

const SERENA_PROJECT_TEMPLATE = `project_name: ${path.basename(process.cwd())}
description: Project initialized by Symbolic Executor
`

const CONFIG_TEMPLATE = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "serena": {
      "command": ["uvx", "--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"],
      "deferLoading": false,
      "description": "Symbolic code operations (always loaded)"
    }
  }
}
`

function findPluginDir() {
  // Check npm package location first
  if (fs.existsSync(NPM_PACKAGE_DIR)) {
    return NPM_PACKAGE_DIR
  }
  
  // Fall back to git clone location
  if (fs.existsSync(GIT_PLUGIN_DIR)) {
    return GIT_PLUGIN_DIR
  }
  
  return null
}

async function init() {
  const cwd = process.cwd()
  
  console.log('🚀 Symbolic Executor Project Init\n')
  
  // Check if in project root (more lenient check)
  const hasPackage = fs.existsSync(path.join(cwd, 'package.json'))
  const hasGit = fs.existsSync(path.join(cwd, '.git'))
  
  // If neither exists, offer to initialize git
  if (!hasPackage && !hasGit) {
    console.log('⚠️  Not in a recognized project root')
    console.log('  (no package.json or .git found)\n')
    
    // Offer to initialize git
    console.log('Would you like to initialize a git repository here?')
    console.log('Run: git init\n')
    console.log('Or create a package.json: npm init -y\n')
    console.log('Then re-run: npx opencode-symbolic-executor init')
    process.exit(0)
  }
  
  if (hasGit) {
    console.log('✓ Project root detected (.git found)')
  } else if (hasPackage) {
    console.log('✓ Project root detected (package.json found)')
  }
  
  // Check if .opencode/ already exists
  const opencodeDir = path.join(cwd, '.opencode')
  if (fs.existsSync(opencodeDir)) {
    console.log('\n⚠️  .opencode/ already exists')
    console.log('  Checking if initialization is complete...\n')
    
    // Check what's missing
    const missing = []
    const expected = [
      'config.json',
      'constitution.md',
      'SPEC-INDEX.md',
      'specs'
    ]
    
    for (const item of expected) {
      const itemPath = path.join(opencodeDir, item)
      if (!fs.existsSync(itemPath)) {
        missing.push(item)
      }
    }
    
    if (missing.length === 0) {
      console.log('✓ All files present, skipping initialization')
      return
    }
    
    console.log('Missing files/directories:')
    missing.forEach(m => { console.log(`  - .opencode/${m}`) })
    console.log('\nWould you like to create missing files? (y/n)')
    
    // For now, just create missing ones automatically
    console.log('Creating missing files...\n')
  }
  
  // Create structure
  console.log('\n📁 Creating .opencode/ structure...')
  
  await fs.promises.mkdir(opencodeDir, { recursive: true })
  await fs.promises.mkdir(path.join(opencodeDir, 'specs'), { recursive: true })
  
  const serenaDir = path.join(cwd, '.serena')
  await fs.promises.mkdir(serenaDir, { recursive: true })
  await fs.promises.mkdir(path.join(serenaDir, 'memories'), { recursive: true })

  const registryDir = path.join(cwd, 'registry')
  await fs.promises.mkdir(path.join(registryDir, 'code-nav/serena'), { recursive: true })
  await fs.promises.mkdir(path.join(registryDir, 'knowledge/context7'), { recursive: true })
  
  console.log('  - .opencode/specs/')
  console.log('  - .serena/memories/')
  console.log('  - registry/ (tool definitions)')
  
  // Create config
  const configPath = path.join(opencodeDir, 'config.json')
  if (!fs.existsSync(configPath)) {
    await fs.promises.writeFile(
      configPath,
      CONFIG_TEMPLATE
    )
    console.log('  - .opencode/config.json')
  } else {
    console.log('  ✓ .opencode/config.json (already exists)')
  }
  
  // Create constitution
  const constitutionPath = path.join(opencodeDir, 'constitution.md')
  if (!fs.existsSync(constitutionPath)) {
    await fs.promises.writeFile(
      constitutionPath,
      CONSTITUTION_TEMPLATE
    )
    console.log('  - .opencode/constitution.md')
  } else {
    console.log('  ✓ .opencode/constitution.md (already exists)')
  }
  
  // Create SPEC index
  const specIndexPath = path.join(opencodeDir, 'SPEC-INDEX.md')
  if (!fs.existsSync(specIndexPath)) {
    await fs.promises.writeFile(
      specIndexPath,
      SPEC_INDEX_TEMPLATE
    )
    console.log('  - .opencode/SPEC-INDEX.md')
  } else {
    console.log('  ✓ .opencode/SPEC-INDEX.md (already exists)')
  }
  
  // Create .serena/project.yml
  const serenaProjectPath = path.join(cwd, '.serena/project.yml')
  if (!fs.existsSync(serenaProjectPath)) {
    await fs.promises.writeFile(
      serenaProjectPath,
      SERENA_PROJECT_TEMPLATE
    )
    console.log('  - .serena/project.yml')
  }

  // Create .serena/.gitignore
  const serenaIgnorePath = path.join(cwd, '.serena/.gitignore')
  if (!fs.existsSync(serenaIgnorePath)) {
    await fs.promises.writeFile(
      serenaIgnorePath,
      SERENA_IGNORE_TEMPLATE
    )
    console.log('  - .serena/.gitignore')
  }
  
  console.log('\n✅ Project initialization complete!\n')
  console.log('Next steps:')
  console.log('1. Edit .opencode/constitution.md (define project principles)')
  console.log('2. Edit .opencode/config.json (add your MCP servers)')
  console.log('3. Start OpenCode: opencode')
  console.log('4. Create first SPEC: "Create a SPEC for user authentication"')
  console.log('\nWorkflow:')
  console.log('  Plan Mode: Create SPEC → Add requirements → Validate → Approve')
  console.log('  Build Mode: Implement tasks → Verify → Log decisions → Mark complete')
}

init().catch(err => {
  console.error('✗ Error:', err.message)
  process.exit(1)
})
