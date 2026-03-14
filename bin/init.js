#!/usr/bin/env node

/**
 * CLI fallback for project initialization.
 * Creates minimal .opencode/ and .serena/ scaffolding.
 * For full interactive setup, use /symb-init inside OpenCode.
 */

import fs from 'node:fs'
import path from 'node:path'

const CONSTITUTION_TEMPLATE = `# Project Constitution

Project contract: the agent MUST follow these rules in this repo.

## RULES
- MUST NOT implement without an approved SPEC. All requirements MUST be testable.
- MUST NOT ship with compiler errors, linter warnings, or LSP errors. Fix before commit.
- MUST NOT put secrets in code. MUST validate all inputs.
- MUST meet all SPEC acceptance criteria and run build/tests before commit. Document decisions in the SPEC.

## GATES (definition of done)
Ship only when: 0 compiler errors, 0 lint warnings, all SPEC acceptance criteria met.

## PROJECT-SPECIFIC (optional)
<!-- Architecture layers, dependencies, code style. Fill based on language/framework. -->
`

const SPEC_INDEX_TEMPLATE = `# SPEC Index

| ID | Feature | Status | Iteration | Last Updated |
|----|---------|--------|-----------|--------------|

## Active SPECs

## Archived SPECs
`

const CONFIG_TEMPLATE = `{
  "$schema": "https://opencode.ai/config.json"
}
`

const SERENA_PROJECT_TEMPLATE = (name) => `project_name: "${name}"
languages:
- typescript
encoding: "utf-8"
ignore_all_files_in_gitignore: true
ignored_paths: []
read_only: false
excluded_tools: []
included_optional_tools: []
fixed_tools: []
initial_prompt: ""
`

async function init() {
  const cwd = process.cwd()
  const projectName = path.basename(cwd)

  console.log('Symbolic Executor - Project Init\n')

  const hasPackage = fs.existsSync(path.join(cwd, 'package.json'))
  const hasGit = fs.existsSync(path.join(cwd, '.git'))

  if (!hasPackage && !hasGit) {
    console.log('Not in a recognized project root (no package.json or .git).')
    console.log('Run: git init   or   npm init -y')
    console.log('Then re-run: npx opencode-symbolic-executor init')
    process.exit(0)
  }

  if (hasGit) {
    console.log('[ok] Project root detected (.git)')
  } else {
    console.log('[ok] Project root detected (package.json)')
  }

  const opencodeDir = path.join(cwd, '.opencode')
  if (fs.existsSync(opencodeDir)) {
    const expected = ['config.json', 'constitution.md', 'SPEC-INDEX.md', 'specs']
    const missing = expected.filter(item => !fs.existsSync(path.join(opencodeDir, item)))

    if (missing.length === 0) {
      console.log('[ok] .opencode/ already initialized, nothing to do.')
      console.log('\nFor full interactive setup, run /symb-init inside OpenCode.')
      return
    }

    console.log(`Missing: ${missing.join(', ')}. Creating...`)
  }

  // Create .opencode/ structure
  await fs.promises.mkdir(path.join(opencodeDir, 'specs'), { recursive: true })
  console.log('  .opencode/specs/')

  const writeIfMissing = async (filePath, content) => {
    if (!fs.existsSync(filePath)) {
      await fs.promises.writeFile(filePath, content)
      console.log(`  ${path.relative(cwd, filePath)}`)
    } else {
      console.log(`  ${path.relative(cwd, filePath)} (exists)`)
    }
  }

  await writeIfMissing(path.join(opencodeDir, 'config.json'), CONFIG_TEMPLATE)
  await writeIfMissing(path.join(opencodeDir, 'constitution.md'), CONSTITUTION_TEMPLATE)
  await writeIfMissing(path.join(opencodeDir, 'SPEC-INDEX.md'), SPEC_INDEX_TEMPLATE)

  // Create .serena/ structure
  const serenaDir = path.join(cwd, '.serena')
  await fs.promises.mkdir(serenaDir, { recursive: true })

  await writeIfMissing(path.join(serenaDir, 'project.yml'), SERENA_PROJECT_TEMPLATE(projectName))
  await writeIfMissing(path.join(serenaDir, '.gitignore'), 'memories/\n')

  console.log('\n[done] Project scaffolding created.\n')
  console.log('Next steps:')
  console.log('  1. Ensure Serena MCP is in your GLOBAL OpenCode config (~/.config/opencode/opencode.json)')
  console.log('     Add under "mcp": { "serena": { "type": "local", "command": ["/path/to/uvx",')
  console.log('     "--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server",')
  console.log('     "--context", "ide", "--project-from-cwd"], "enabled": true } }')
  console.log('  2. Start OpenCode: opencode')
  console.log('  3. Run /symb-init for full interactive setup (language config, Serena activation, onboarding)')
  console.log('  4. Or manually edit .serena/project.yml to configure languages')
}

init().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
