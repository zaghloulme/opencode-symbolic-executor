/**
 * Tool catalog builder
 * Generates pre-built catalog from MCP server definitions
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ToolCatalog, CatalogBuildOptions, CatalogBuildResult } from './types'
import { buildServerCatalog } from '../utils/mcp-client.js'

interface MCPConfig {
  mcpServers?: Record<string, {
    command: string | string[]
    deferLoading?: boolean
    triggers?: string[]
    regexPatterns?: string[]
    description?: string
    env?: Record<string, string>
  }>
  mcp?: Record<string, {
    command: string | string[]
    enabled?: boolean
    type?: string
    url?: string
    env?: Record<string, string>
  }>
}

/**
 * Load MCP configuration from global config (~/.config/opencode/opencode.json)
 * Falls back to project config (.opencode/config.json)
 * NO templates - reads user's actual configuration only
 */
async function loadMCPConfig(directory: string): Promise<MCPConfig> {
  const globalConfigPath = path.join(process.env.HOME || '', '.config/opencode/opencode.json')
  const localConfigPath = path.join(directory, '.opencode/config.json')
  
  let config: MCPConfig = {}
  
  // Try global config first (primary source)
  try {
    const globalContent = await fs.readFile(globalConfigPath, 'utf-8')
    const globalConfig = JSON.parse(globalContent)
    
    // Convert global mcp format to mcpServers format
    if (globalConfig.mcp) {
      config.mcpServers = {}
      for (const [serverId, serverConfig] of Object.entries(globalConfig.mcp)) {
        const cfg = serverConfig as any
        // Include only enabled local MCPs
        if (cfg.enabled !== false && cfg.type === 'local') {
          config.mcpServers[serverId] = {
            command: cfg.command,
            deferLoading: true,
            env: cfg.env,
          }
        }
      }
    }
    
    // Also check for mcpServers format in global config
    if (globalConfig.mcpServers) {
      config.mcpServers = {
        ...config.mcpServers,
        ...globalConfig.mcpServers,
      }
    }
  } catch (error) {
    // Global config not found, try local
    try {
      const localContent = await fs.readFile(localConfigPath, 'utf-8')
      config = JSON.parse(localContent)
    } catch {
      // No config found - return empty
    }
  }
  
  return config
}

/**
 * Build tool catalog from MCP servers
 */
export async function buildToolCatalog(
  directory: string,
  options: CatalogBuildOptions = {}
): Promise<CatalogBuildResult> {
  const {
    timeoutPerServer = 10000,
    logDir = path.join(process.env.HOME || '', '.config/opencode/logs'),
  } = options
  
  const logs: string[] = []
  const startTime = Date.now()
  
  const log = (message: string) => {
    const timestamp = new Date().toISOString()
    logs.push(`[${timestamp}] ${message}`)
    console.log(`[catalog] ${message}`)
  }
  
  log('Starting tool catalog build')
  
  try {
    // Load configuration
    const config = await loadMCPConfig(directory)
    const mcpServers = config.mcpServers || {}
    
    if (Object.keys(mcpServers).length === 0) {
      log('No MCP servers configured with deferLoading')
      return {
        success: false,
        error: 'No MCP servers found in configuration',
        logs,
      }
    }
    
    // Build catalog for each server
    const catalog: ToolCatalog = {
      version: 1,
      builtAt: new Date().toISOString(),
      servers: {},
    }
    
    let successCount = 0
    let errorCount = 0
    
    for (const [serverId, serverConfig] of Object.entries(mcpServers)) {
      log(`Building catalog for server: ${serverId}`)
      
      try {
        const result = await buildServerCatalog(serverId, {
          ...serverConfig,
          deferLoading: serverConfig.deferLoading ?? true,
          timeout: timeoutPerServer,
        } as any)
        
        catalog.servers[serverId] = result.catalog
        
        if (result.error) {
          log(`✗ ${serverId}: ${result.error}`)
          errorCount++
        } else {
          log(`✓ ${serverId}: ${result.catalog.tools.length} tools`)
          successCount++
        }
        
        // Merge logs
        logs.push(...result.logs.map(l => `[${serverId}] ${l}`))
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        log(`✗ ${serverId}: ${errorMessage}`)
        errorCount++
        
        catalog.servers[serverId] = {
          command: serverConfig.command,
          deferLoading: serverConfig.deferLoading ?? true,
          triggers: serverConfig.triggers,
          regexPatterns: serverConfig.regexPatterns,
          description: serverConfig.description,
          tools: [],
        }
      }
    }
    
    // Write catalog to file
    const catalogPath = path.join(directory, '.opencode/tools-catalog.json')
    await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8')
    log(`Catalog written to: ${catalogPath}`)
    
    // Write build log
    await ensureDir(logDir)
    const logPath = path.join(logDir, `catalog-build-${Date.now()}.log`)
    await fs.writeFile(logPath, logs.join('\n'), 'utf-8')
    log(`Build log written to: ${logPath}`)
    
    const duration = Date.now() - startTime
    log(`Catalog build complete: ${successCount} succeeded, ${errorCount} failed (${duration}ms)`)
    
    return {
      success: true,
      catalog,
      logs,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log(`Catalog build failed: ${errorMessage}`)
    
    // Write error log
    try {
      await ensureDir(logDir)
      const logPath = path.join(logDir, `catalog-build-error-${Date.now()}.log`)
      await fs.writeFile(logPath, logs.join('\n') + `\n\nERROR: ${errorMessage}`, 'utf-8')
    } catch {
      // Ignore log write errors
    }
    
    return {
      success: false,
      error: errorMessage,
      logs,
    }
  }
}

/**
 * Load existing tool catalog
 */
export async function loadToolCatalog(directory: string): Promise<ToolCatalog | null> {
  const catalogPath = path.join(directory, '.opencode/tools-catalog.json')
  
  try {
    const content = await fs.readFile(catalogPath, 'utf-8')
    return JSON.parse(content) as ToolCatalog
  } catch {
    return null
  }
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath)
  } catch {
    await fs.mkdir(dirPath, { recursive: true })
  }
}

/**
 * Check if catalog needs rebuilding
 */
export async function needsCatalogRebuild(directory: string): Promise<boolean> {
  const catalogPath = path.join(directory, '.opencode/tools-catalog.json')
  
  try {
    const stat = await fs.stat(catalogPath)
    const age = Date.now() - stat.mtimeMs
    
    // Rebuild if older than 1 hour
    return age > 3600000
  } catch {
    // Catalog doesn't exist, needs build
    return true
  }
}
