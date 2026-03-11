#!/usr/bin/env node

/**
 * Smart Config Merge Script
 * 
 * Merges symbolic-executor configuration with existing OpenCode config.
 * Creates backup before modifying.
 * 
 * Does:
 * - Adds symbolic-executor to plugins array (avoids duplicates)
 * - Adds deferLoading: true to all MCPs except serena
 * - Adds triggers to MCPs for on-demand loading
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

// Trigger definitions for common MCP servers
const MCP_TRIGGERS = {
  context7: ['library', 'package', 'API', 'docs', 'dependency', 'npm'],
  sanity: ['sanity', 'CMS', 'content', 'schema', 'studio'],
  'next-devtools': ['Next.js', 'next', 'dev server', 'build', 'runtime'],
  nodesecure: ['security', 'CVE', 'audit', 'vulnerability', 'dependency'],
  playwright: ['browser', 'screenshot', 'visual', 'test', 'e2e', 'automation'],
  grep_app: ['github', 'code', 'search', 'repository'],
  kindly: ['web', 'search', 'google', 'research'],
  lighthouse: ['performance', 'audit', 'lighthouse', 'score'],
  git: ['git', 'commit', 'branch', 'merge', 'diff'],
  sequential: ['think', 'reason', 'analyze', 'plan'],
  docling: ['document', 'pdf', 'parse', 'extract'],
}

function getTriggersForServer(name) {
  // Try exact match first
  if (MCP_TRIGGERS[name]) {
    return MCP_TRIGGERS[name]
  }
  
  // Try partial match
  for (const [key, triggers] of Object.entries(MCP_TRIGGERS)) {
    if (name.includes(key) || key.includes(name)) {
      return triggers
    }
  }
  
  // Default: use server name as trigger
  return [name]
}

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
    
    if (!config.plugin.includes('symbolic-executor')) {
      config.plugin.push('symbolic-executor')
      console.log('✓ Added symbolic-executor to plugins')
    } else {
      console.log('✓ symbolic-executor already in plugins')
    }
    
    // Add deferLoading to MCP servers
    if (config.mcpServers) {
      let modifiedCount = 0
      
      for (const [name, server] of Object.entries(config.mcpServers)) {
        // Skip serena (always loaded)
        if (name === 'serena') {
          continue
        }
        
        // Add deferLoading if missing
        if (!server.deferLoading) {
          server.deferLoading = true
          modifiedCount++
        }
        
        // Add triggers if missing
        if (!server.triggers) {
          server.triggers = getTriggersForServer(name)
          modifiedCount++
        }
      }
      
      if (modifiedCount > 0) {
        console.log(`✓ Updated ${modifiedCount} MCP servers with deferLoading and triggers`)
      } else {
        console.log('✓ All MCP servers already configured correctly')
      }
    } else {
      console.log('✓ No MCP servers configured')
    }
    
    // Add symbolicExecutor config section if missing
    if (!config.symbolicExecutor) {
      config.symbolicExecutor = {
        enableSPECWorkflow: true,
        enableToolSearch: true,
        visualThreshold: 0.90,
        maxRevisions: 3,
      }
      console.log('✓ Added symbolicExecutor configuration')
    } else {
      console.log('✓ symbolicExecutor configuration already exists')
    }
    
    // Write merged config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    console.log('✓ Config updated:', configPath)
    
    console.log('\n✅ Configuration merge complete!\n')
    console.log('Next steps:')
    console.log('1. Restart OpenCode if running')
    console.log('2. Initialize a project: node ~/.config/opencode/plugins/symbolic-executor/bin/init')
    console.log('3. Create your first SPEC: "Create a SPEC for user authentication"')
    
  } catch (error) {
    console.error('✗ Error merging config:', error.message)
    
    // Try to restore backup
    if (fs.existsSync(backupPath)) {
      console.log('  Backup available at:', backupPath)
    }
    
    process.exit(1)
  }
}

mergeConfig()
