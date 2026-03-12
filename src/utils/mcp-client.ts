/**
 * MCP client for communicating with MCP servers
 * Handles spawning, listing tools, and graceful shutdown
 */

import { spawn } from 'node:child_process'
import type { MCPServerCatalog, ToolDefinition, PropertyDefinition } from '../catalog/types'

const MCP_TIMEOUT = 10000 // 10 seconds per server

interface JSONRPCRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: Record<string, any>
}

interface JSONRPCResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

export class MCPClient {
  private logs: string[] = []

  private log(message: string): void {
    const timestamp = new Date().toISOString()
    this.logs.push(`[${timestamp}] ${message}`)
  }

  async listTools(serverConfig: {
    command: string | string[]
    env?: Record<string, string>
  }): Promise<ToolDefinition[]> {
    const timeout = MCP_TIMEOUT
    this.log(`Starting MCP server`)

    return new Promise((resolve, reject) => {
      const cmd = Array.isArray(serverConfig.command)
        ? serverConfig.command[0]
        : serverConfig.command.split(' ')[0]
      const args = Array.isArray(serverConfig.command)
        ? serverConfig.command.slice(1)
        : serverConfig.command.split(' ').slice(1)

      this.log(`Spawning: ${cmd}`)

      const child = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...serverConfig.env },
      })

      let requestId = 0
      let toolsRequestId = 0
      let initialized = false

      const cleanup = () => {
        if (!child.killed) {
          child.kill('SIGTERM')
          setTimeout(() => { if (!child.killed) child.kill('SIGKILL') }, 1000)
        }
      }

      const timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error(`MCP server timeout after ${timeout / 1000}s`))
      }, timeout)

      child.stderr.on('data', (data) => {
        this.log(`stderr: ${data.toString().trim()}`)
      })

      child.on('error', (err) => {
        clearTimeout(timeoutId)
        cleanup()
        reject(new Error(`Failed to spawn MCP server: ${err.message}`))
      })

      child.on('close', (code) => {
        if (!initialized) {
          clearTimeout(timeoutId)
          reject(new Error(`MCP server exited with code ${code}`))
        }
      })

      const processLine = (line: string) => {
        try {
          const response: JSONRPCResponse = JSON.parse(line)
          
          if (response.id === requestId && response.result) {
            initialized = true
            this.log('MCP server initialized')
            
            const initializedNotification = { jsonrpc: '2.0' as const, method: 'notifications/initialized' }
            child.stdin.write(JSON.stringify(initializedNotification) + '\n')
            
            setTimeout(() => {
              toolsRequestId = ++requestId
              const toolsRequest: JSONRPCRequest = {
                jsonrpc: '2.0',
                id: toolsRequestId,
                method: 'tools/list',
                params: {},
              }
              child.stdin.write(JSON.stringify(toolsRequest) + '\n')
            }, 200)
          } else if (response.id === toolsRequestId && response.result) {
            clearTimeout(timeoutId)
            cleanup()
            const tools = this.parseToolsResponse(response.result)
            this.log(`Retrieved ${tools.length} tools`)
            resolve(tools)
          } else if (response.error) {
            clearTimeout(timeoutId)
            cleanup()
            reject(new Error(response.error.message))
          }
        } catch { /* Ignore parse errors */ }
      }

      let buffer = ''
      child.stdout.on('data', (data) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.trim()) processLine(line)
        }
      })

      requestId = 1
      const initRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { roots: { listChanged: true } },
          clientInfo: { name: 'opencode-symbolic-executor', version: '0.4.0' },
        },
      }
      
      setTimeout(() => {
        child.stdin.write(JSON.stringify(initRequest) + '\n')
      }, 500)
    })
  }

  private parseToolsResponse(result: any): ToolDefinition[] {
    if (!result || !result.tools || !Array.isArray(result.tools)) {
      return []
    }

    return result.tools.map((tool: any) => {
      const inputSchema = tool.inputSchema || {}
      const properties: Record<string, PropertyDefinition> = {}

      if (inputSchema.properties) {
        for (const [key, value] of Object.entries(inputSchema.properties)) {
          const prop = value as any
          properties[key] = {
            type: prop.type || 'string',
            description: prop.description,
            enum: prop.enum,
            default: prop.default,
          }
        }
      }

      return {
        name: tool.name || 'unknown',
        description: tool.description || '',
        inputSchema: {
          type: inputSchema.type || 'object',
          properties,
          required: inputSchema.required || [],
        },
        examples: [],
      }
    })
  }

  getLogs(): string[] {
    return [...this.logs]
  }
}

export async function buildServerCatalog(
  serverId: string,
  serverConfig: {
    command: string | string[]
    deferLoading: boolean
    triggers?: string[]
    regexPatterns?: string[]
    description?: string
    env?: Record<string, string>
  }
): Promise<{
  catalog: MCPServerCatalog
  logs: string[]
  error?: string
}> {
  const client = new MCPClient()
  
  try {
    const tools = await client.listTools({
      command: serverConfig.command,
      env: serverConfig.env,
    })

    return {
      catalog: {
        command: serverConfig.command,
        deferLoading: serverConfig.deferLoading,
        triggers: serverConfig.triggers,
        regexPatterns: serverConfig.regexPatterns,
        description: serverConfig.description,
        tools,
      },
      logs: client.getLogs(),
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      catalog: {
        command: serverConfig.command,
        deferLoading: serverConfig.deferLoading,
        triggers: serverConfig.triggers,
        regexPatterns: serverConfig.regexPatterns,
        description: serverConfig.description,
        tools: [],
      },
      logs: client.getLogs(),
      error: errorMessage,
    }
  }
}
