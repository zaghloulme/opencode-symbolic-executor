/**
 * OpencodeClient Type Definitions
 * 
 * Minimal type definitions for OpenCode client.
 * Import actual types from @opencode-ai/sdk when building.
 */

export interface OpencodeClient {
  /**
   * Get configuration
   */
  config: {
    get: () => Promise<{ data: any }>
  }

  /**
   * Create session
   */
  session: {
    create: (params: { body: { title: string; parentID?: string } }) => Promise<{ data?: { id?: string } }>
  }

  /**
   * Send notification
   */
  notify: (message: string) => Promise<void>

  /**
   * Register hooks
   */
  hooks: {
    on: (event: string, handler: (...args: any[]) => Promise<void>) => void
  }
}

export interface Project {
  /**
   * Project root directory
   */
  root: string

  /**
   * Project name
   */
  name?: string
}

export interface Message {
  /**
   * Message content
   */
  content: string

  /**
   * Message role
   */
  role: "user" | "assistant"
}

export interface ToolEvent {
  /**
   * Tool name
   */
  tool: {
    name: string
    input: any
  }

  /**
   * Deny tool execution with reason
   */
  deny: (reason: string) => void
}

export interface ToolResult {
  /**
   * Tool execution result
   */
  result: any
}

