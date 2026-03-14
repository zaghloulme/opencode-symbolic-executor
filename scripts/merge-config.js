#!/usr/bin/env node

/**
 * Smart Config Merge Script
 *
 * Merges symbolic-executor configuration with existing OpenCode config.
 * Creates backup before modifying.
 *
 * Does:
 * - Adds opencode-symbolic-executor to plugins array (avoids duplicates)
 * - Creates backup at ~/.config/opencode/opencode.json.backup
 *
 * Does NOT:
 * - Remove existing plugins
 * - Remove existing MCPs
 * - Modify other config sections
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const configPath = path.join(os.homedir(), '.config/opencode/opencode.json')
const backupPath = configPath + '.backup'

async function mergeConfig() {
  console.log('🔧 Symbolic Executor Config Merger\n')

  // Check if config exists
  if (!fs.existsSync(configPath)) {
    console.error('✗ Error: OpenCode config not found at:', configPath)
    console.error('  Run "opencode" first to create config, then re-run this script.')
    process.exit(1)
  }

  try {
    // Read existing config
    const configText = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(configText)

    // Create backup
    fs.writeFileSync(backupPath, JSON.stringify(config, null, 2))
    console.log('✓ Backup created:', backupPath)

    // Add plugin (avoid duplicates)
    if (!config.plugin) {
      config.plugin = []
    }

    const pluginName = 'opencode-symbolic-executor'
    if (!config.plugin.includes(pluginName)) {
      config.plugin.push(pluginName)
      console.log('✓ Added', pluginName, 'to plugins')
    } else {
      console.log('✓', pluginName, 'already in plugins')
    }

    // Write merged config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    console.log('✓ Config updated:', configPath)

    console.log('\n✅ Configuration merge complete!\n')
    console.log('Next steps:')
    console.log('1. Restart OpenCode if running')
    console.log('2. Run /symb-init in OpenCode or: npx opencode-symbolic-executor init')
    console.log('3. Create your first SPEC: "Create a SPEC for user authentication"')

  } catch (error) {
    console.error('✗ Error merging config:', error.message)

    if (fs.existsSync(backupPath)) {
      console.log('  Backup available at:', backupPath)
    }

    process.exit(1)
  }
}

mergeConfig()
