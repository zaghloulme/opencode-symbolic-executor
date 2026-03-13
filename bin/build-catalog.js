#!/usr/bin/env node

/**
 * Build Tool Catalog Command
 * 
 * Pre-builds tool catalog from MCP servers with deferLoading: true
 * Creates .opencode/tools-catalog.json for lazy tool loading
 * 
 * Usage:
 *   npx opencode-symbolic-executor build-catalog
 * 
 * Options:
 *   --timeout <ms>  Timeout per MCP server (default: 10000)
 *   --force         Force rebuild even if catalog exists
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function buildCatalog() {
  const args = process.argv.slice(2)
  const timeout = parseInt(args.find(a => a.startsWith('--timeout='))?.split('=')[1] || '10000')
  const force = args.includes('--force')
  
  const cwd = process.cwd()
  const catalogPath = path.join(cwd, '.opencode/tools-catalog.json')
  
  console.log('🔧 Building Tool Catalog\n')
  
  // Check if in project root
  const hasPackage = fs.existsSync(path.join(cwd, 'package.json'))
  const hasGit = fs.existsSync(path.join(cwd, '.git'))
  
  if (!hasPackage && !hasGit) {
    console.log('⚠️  Not in a recognized project root')
    console.log('  (no package.json or .git found)\n')
    console.log('Run this command from your project directory')
    process.exit(1)
  }
  
  // Check if .opencode exists
  const opencodeDir = path.join(cwd, '.opencode')
  if (!fs.existsSync(opencodeDir)) {
    console.log('⚠️  .opencode/ directory not found')
    console.log('  Run: npx opencode-symbolic-executor init\n')
    process.exit(1)
  }
  
  // Check if catalog exists and is recent
  if (!force && fs.existsSync(catalogPath)) {
    try {
      const stat = await fs.promises.stat(catalogPath)
      const age = Date.now() - stat.mtimeMs
      const ageHours = Math.floor(age / 3600000)
      
      if (ageHours < 1) {
        console.log(`✓ Catalog exists and is recent (${Math.floor(age / 60000)}m old)`)
        console.log('  Use --force to rebuild\n')
        return
      }
    } catch {
      // Continue with build
    }
  }
  
  console.log(`⏱️  Timeout per server: ${timeout / 1000}s`)
  console.log(`📁 Output: ${catalogPath}\n`)
  
  try {
    // Import builder
    const { buildToolCatalog } = await import('../dist/catalog/builder.js')
    
    // Build catalog
    const result = await buildToolCatalog(cwd, {
      timeoutPerServer: timeout,
      logDir: path.join(process.env.HOME || '', '.config/opencode/logs'),
    })
    
    if (result.success) {
      console.log('\n✅ Catalog build complete!')
      
      if (result.catalog) {
        const toolCount = Object.values(result.catalog.servers)
          .reduce((sum, s) => sum + (s.tools?.length || 0), 0)
        const serverCount = Object.keys(result.catalog.servers).length
        
        console.log(`   Servers: ${serverCount}`)
        console.log(`   Total tools: ${toolCount}`)
      }
      
      console.log('\nLazy tool loading is now enabled.')
      console.log('Use tool_search to find and load tools on-demand.')
    } else {
      console.log('\n⚠️  Catalog build completed with errors')
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
      console.log('\nCheck logs in ~/.config/opencode/logs/')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.log('\n✗ Catalog build failed')
    console.log(`   Error: ${errorMessage}`)
    console.log('\nMake sure the plugin is built: npm run build')
    process.exit(1)
  }
}

buildCatalog().catch(err => {
  console.error('✗ Unexpected error:', err.message)
  process.exit(1)
})
