/**
 * Edit operations for hashline edit tool
 * Implements set_line, replace_lines, insert_after, insert_before operations
 * Based on oh-my-pi / oh-my-openagent implementation
 */

/**
 * Edit operation types
 */
export type EditOp =
  | { type: "set_line"; line: number; content: string }
  | { type: "replace_lines"; start: number; end: number; content: string[] }
  | { type: "insert_after"; line: number; content: string[] }
  | { type: "insert_before"; line: number; content: string[] }
  | { type: "delete_lines"; start: number; end: number };

/**
 * Result of applying an edit operation
 */
export interface EditResult {
  /** Number of lines changed (positive = added, negative = removed) */
  delta: number;
  /** Whether the edit was a no-op (no actual change) */
  isNoop: boolean;
}

/**
 * Apply a single edit operation to file lines
 *
 * @param lines - File content as array of lines (mutated in place)
 * @param op - Edit operation to apply
 * @returns EditResult with delta and noop status
 * @throws Error if operation is invalid
 */
export function applyEdit(lines: string[], op: EditOp): EditResult {
  switch (op.type) {
    case "set_line":
      return applySetLine(lines, op);
    case "replace_lines":
      return applyReplaceLines(lines, op);
    case "insert_after":
      return applyInsertAfter(lines, op);
    case "insert_before":
      return applyInsertBefore(lines, op);
    case "delete_lines":
      return applyDeleteLines(lines, op);
    default:
      throw new Error(`Unknown edit operation: ${(op as any).type}`);
  }
}

/**
 * Apply set_line operation: replace single line at position
 */
function applySetLine(lines: string[], op: { type: "set_line"; line: number; content: string }): EditResult {
  const index = op.line - 1;

  if (index < 0 || index >= lines.length) {
    throw new Error(`Line ${op.line} out of bounds (file has ${lines.length} lines)`);
  }

  const isNoop = lines[index] === op.content;
  if (!isNoop) {
    lines[index] = op.content;
  }

  return { delta: 0, isNoop };
}

/**
 * Apply replace_lines operation: replace range of lines with new content
 */
function applyReplaceLines(
  lines: string[],
  op: { type: "replace_lines"; start: number; end: number; content: string[] },
): EditResult {
  const startIndex = op.start - 1;
  const endIndex = op.end;

  if (startIndex < 0 || endIndex > lines.length || startIndex >= endIndex) {
    throw new Error(`Invalid range [${op.start}, ${op.end}] for file with ${lines.length} lines`);
  }

  const oldLength = endIndex - startIndex;
  const newLength = op.content.length;
  const delta = newLength - oldLength;

  // Check if it's a no-op
  const isNoop = delta === 0 && op.content.every((line, i) => lines[startIndex + i] === line);

  if (!isNoop) {
    lines.splice(startIndex, oldLength, ...op.content);
  }

  return { delta, isNoop };
}

/**
 * Apply insert_after operation: insert lines after specified position
 */
function applyInsertAfter(lines: string[], op: { type: "insert_after"; line: number; content: string[] }): EditResult {
  if (op.line < 0 || op.line > lines.length) {
    throw new Error(`Line ${op.line} out of bounds for insertion (file has ${lines.length} lines)`);
  }

  if (op.content.length === 0) {
    return { delta: 0, isNoop: true };
  }

  lines.splice(op.line, 0, ...op.content);
  return { delta: op.content.length, isNoop: false };
}

/**
 * Apply insert_before operation: insert lines before specified position
 */
function applyInsertBefore(
  lines: string[],
  op: { type: "insert_before"; line: number; content: string[] },
): EditResult {
  if (op.line < 1 || op.line > lines.length + 1) {
    throw new Error(`Line ${op.line} out of bounds for insertion (file has ${lines.length} lines)`);
  }

  if (op.content.length === 0) {
    return { delta: 0, isNoop: true };
  }

  lines.splice(op.line - 1, 0, ...op.content);
  return { delta: op.content.length, isNoop: false };
}

/**
 * Apply delete_lines operation: remove range of lines
 */
function applyDeleteLines(lines: string[], op: { type: "delete_lines"; start: number; end: number }): EditResult {
  const startIndex = op.start - 1;
  const endIndex = op.end;

  if (startIndex < 0 || endIndex > lines.length || startIndex >= endIndex) {
    throw new Error(`Invalid range [${op.start}, ${op.end}] for deletion`);
  }

  const count = endIndex - startIndex;
  lines.splice(startIndex, count);
  return { delta: -count, isNoop: false };
}

/**
 * Parse edit operation from hashline edit payload
 * Converts from API format to internal EditOp format
 *
 * @param edit - Edit payload from API
 * @param lines - Current file lines for validation
 * @returns Parsed EditOp or error message
 */
export function parseEditOperation(
  edit: {
    op: "replace" | "append" | "prepend";
    pos?: string;
    end?: string;
    lines?: string | string[];
  },
  lines: string[],
): { operation: EditOp } | { error: string } {
  const content = normalizeEditContent(edit.lines ?? []);

  switch (edit.op) {
    case "replace": {
      if (!edit.pos) {
        return { error: "replace operation requires pos anchor" };
      }

      const posRef = parseLineRefSafe(edit.pos);
      if (!posRef) {
        return { error: `Invalid pos anchor: ${edit.pos}` };
      }

      if (edit.end) {
        // Range replace
        const endRef = parseLineRefSafe(edit.end);
        if (!endRef) {
          return { error: `Invalid end anchor: ${edit.end}` };
        }

        return {
          operation: {
            type: "replace_lines",
            start: posRef.line,
            end: endRef.line,
            content,
          },
        };
      } else {
        // Single line replace
        return {
          operation: {
            type: "set_line",
            line: posRef.line,
            content: content[0] ?? "",
          },
        };
      }
    }

    case "append": {
      if (!edit.pos) {
        // Append to EOF
        return {
          operation: {
            type: "insert_after",
            line: lines.length,
            content,
          },
        };
      }

      const posRef = parseLineRefSafe(edit.pos);
      if (!posRef) {
        return { error: `Invalid pos anchor: ${edit.pos}` };
      }

      return {
        operation: {
          type: "insert_after",
          line: posRef.line,
          content,
        },
      };
    }

    case "prepend": {
      if (!edit.pos) {
        // Prepend to BOF
        return {
          operation: {
            type: "insert_before",
            line: 1,
            content,
          },
        };
      }

      const posRef = parseLineRefSafe(edit.pos);
      if (!posRef) {
        return { error: `Invalid pos anchor: ${edit.pos}` };
      }

      return {
        operation: {
          type: "insert_before",
          line: posRef.line,
          content,
        },
      };
    }

    default:
      return { error: `Unknown operation: ${(edit as any).op}` };
  }
}

/**
 * Normalize edit content to array of lines
 * Strips hashline prefixes and diff markers
 */
function normalizeEditContent(content: string | string[] | null): string[] {
  if (!content) return [];

  if (Array.isArray(content)) {
    return content.map(stripHashlinePrefix);
  }

  // Split string by actual newlines (not \n literals)
  return content.split("\n").map(stripHashlinePrefix);
}

/**
 * Strip hashline prefix from line if present
 * Removes "123#AB|" or ">>> 123#AB|" prefixes
 */
function stripHashlinePrefix(line: string): string {
  return line.replace(/^\s*(?:>>>|[+-])?\s*\d+\s*#\s*[ZPMQVRWSNKTXJBYH]{2}\|/, "");
}

/**
 * Safely parse line reference, return null on failure
 */
function parseLineRefSafe(ref: string): { line: number } | null {
  try {
    const match = ref.match(/^(\d+)#[ZPMQVRWSNKTXJBYH]{2}/);
    if (match) {
      return { line: Number.parseInt(match[1], 10) };
    }
    return null;
  } catch {
    return null;
  }
}
