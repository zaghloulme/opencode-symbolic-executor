/**
 * Hashline edit tool executor
 * Main execution logic: normalize → validate → order → apply → diff
 * Based on oh-my-pi / oh-my-openagent implementation
 */

import { formatHashLines } from './hash-computation'
import { validateLineRef, HashlineMismatchError } from './validation'
import { applyEdit, parseEditOperation, type EditOp } from './edit-operations'
import { generateHashlineDiff } from './diff-utils'

/**
 * Hashline edit payload from API
 */
export interface HashlineEditPayload {
  /** File path to edit */
  filePath: string
  /** Array of edit operations */
  edits: Array<{
    op: 'replace' | 'append' | 'prepend'
    pos?: string
    end?: string
    lines?: string | string[]
  }>
  /** If true, delete the file instead of editing */
  delete?: boolean
  /** If provided, rename file to this path after editing */
  rename?: string
}

/**
 * Result of hashline edit execution
 */
export interface HashlineEditResult {
  /** Success status */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Unified diff of changes (if successful) */
  diff?: string
  /** Updated file content with hashline tags */
  updatedContent?: string
  /** Path to modified file (may differ if renamed) */
  filePath: string
}

/**
 * Execute hashline edit operations on a file
 * 
 * Workflow:
 * 1. Read current file content
 * 2. Validate all line references against current content
 * 3. Sort edits bottom-up to prevent line number shifts
 * 4. Apply edits to snapshot
 * 5. Generate unified diff
 * 6. Return updated content with hashline tags
 * 
 * @param content - Current file content
 * @param payload - Edit operations to apply
 * @returns HashlineEditResult with success/error and diff
 */
export async function executeHashlineEdits(
  content: string,
  payload: HashlineEditPayload
): Promise<HashlineEditResult> {
  try {
    // Handle file deletion
    if (payload.delete) {
      if (payload.edits.length > 0) {
        return {
          success: false,
          error: 'File deletion requires edits array to be empty',
          filePath: payload.filePath,
        }
      }
      return {
        success: true,
        diff: `--- ${payload.filePath}\n+++ /dev/null\n`,
        updatedContent: '',
        filePath: payload.filePath,
      }
    }

    // Split content into lines
    const lines = content.split('\n')
    const originalLines = [...lines]

    // Parse and validate all edits
    const operations: Array<{ op: EditOp; originalRef?: string }> = []
    
    for (const edit of payload.edits) {
      const result = parseEditOperation(edit, lines)
      
      if ('error' in result) {
        return {
          success: false,
          error: result.error,
          filePath: payload.filePath,
        }
      }
      
      // Validate line references against current content
      try {
        if (edit.pos) {
          validateLineRef(lines, edit.pos)
        }
        if (edit.end) {
          validateLineRef(lines, edit.end)
        }
      } catch (error) {
        if (error instanceof HashlineMismatchError) {
          return {
            success: false,
            error: error.message,
            filePath: payload.filePath,
          }
        }
        return {
          success: false,
          error: (error as Error).message,
          filePath: payload.filePath,
        }
      }
      
      operations.push({ op: result.operation, originalRef: edit.pos })
    }

    // Sort edits bottom-up to prevent line number shifts
    operations.sort((a, b) => {
      const lineA = getOperationLine(a.op)
      const lineB = getOperationLine(b.op)
      return lineB - lineA // Descending order
    })

    // Apply all edits
    let hadNoops = false
    for (const { op } of operations) {
      const result = applyEdit(lines, op)
      if (result.isNoop) {
        hadNoops = true
      }
    }

    // Check if all edits were no-ops
    if (hadNoops && lines.length === originalLines.length) {
      const allUnchanged = lines.every((line, i) => line === originalLines[i])
      if (allUnchanged) {
        return {
          success: false,
          error: 'All edits were no-ops (content unchanged)',
          filePath: payload.filePath,
        }
      }
    }

    // Generate unified diff
    const diff = generateHashlineDiff(
      originalLines.join('\n'),
      lines.join('\n'),
      payload.filePath
    )

    // Format updated content with hashline tags
    const updatedContent = formatHashLines(lines.join('\n'))

    // Handle file rename
    const finalPath = payload.rename ?? payload.filePath

    return {
      success: true,
      diff,
      updatedContent,
      filePath: finalPath,
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      filePath: payload.filePath,
    }
  }
}

/**
 * Extract the primary line number from an edit operation
 * Used for sorting edits bottom-up
 */
function getOperationLine(op: EditOp): number {
  switch (op.type) {
    case 'set_line':
      return op.line
    case 'replace_lines':
      return op.start
    case 'insert_after':
      return op.line
    case 'insert_before':
      return op.line
    case 'delete_lines':
      return op.start
  }
}
