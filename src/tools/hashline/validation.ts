/**
 * Validation for hashline edit tool
 * Validates LINE#ID references against file content
 * Based on oh-my-pi / oh-my-openagent implementation
 */

import { HASHLINE_REF_PATTERN } from "./constants";
import { computeLineHash } from "./hash-computation";

/**
 * Parsed line reference with line number and hash
 */
export interface LineRef {
  line: number;
  hash: string;
}

/**
 * Hash mismatch information for error reporting
 */
interface HashMismatch {
  line: number;
  expected: string;
}

/**
 * Number of context lines to show around mismatches in error output
 */
const MISMATCH_CONTEXT = 2;

/**
 * Regex to extract LINE#ID from text with prefixes
 * Matches: "123#AB" from ">>> 123#AB|" or "+123#AB|"
 */
const LINE_REF_EXTRACT_PATTERN = /([0-9]+#[ZPMQVRWSNKTXJBYH]{2})/;

/**
 * Normalize a line reference string to canonical LINE#ID format
 * Strips prefixes like ">>>", "+", "-", and content after "|"
 *
 * @param ref - Reference string (may include prefixes)
 * @returns Normalized reference in "LINE#ID" format
 */
export function normalizeLineRef(ref: string): string {
  const originalTrimmed = ref.trim();
  let trimmed = originalTrimmed;

  // Strip common prefixes
  trimmed = trimmed.replace(/^(?:>>>|[+-])\s*/, "");
  trimmed = trimmed.replace(/\s*#\s*/, "#");
  trimmed = trimmed.replace(/\|.*$/, "");
  trimmed = trimmed.trim();

  // Validate format
  if (HASHLINE_REF_PATTERN.test(trimmed)) {
    return trimmed;
  }

  // Try to extract LINE#ID from complex string
  const extracted = trimmed.match(LINE_REF_EXTRACT_PATTERN);
  if (extracted) {
    return extracted[1];
  }

  // Return original if no valid format found
  return originalTrimmed;
}

/**
 * Parse a line reference string into line number and hash
 *
 * @param ref - Reference string in "LINE#ID" format
 * @returns Parsed LineRef with line number and hash
 * @throws Error if format is invalid
 */
export function parseLineRef(ref: string): LineRef {
  const normalized = normalizeLineRef(ref);
  const match = normalized.match(HASHLINE_REF_PATTERN);
  if (match) {
    return {
      line: Number.parseInt(match[1], 10),
      hash: match[2],
    };
  }

  // Provide helpful error message
  const hashIdx = normalized.indexOf("#");
  if (hashIdx > 0) {
    const prefix = normalized.slice(0, hashIdx);
    const suffix = normalized.slice(hashIdx + 1);
    if (!/^\d+$/.test(prefix) && /^[ZPMQVRWSNKTXJBYH]{2}$/.test(suffix)) {
      throw new Error(
        `Invalid line reference: "${ref}". "${prefix}" is not a line number. ` +
          `Use the actual line number from the read output.`,
      );
    }
  }

  throw new Error(`Invalid line reference format: "${ref}". Expected format: "{line_number}#{hash_id}"`);
}

/**
 * Validate a line reference against actual file content
 * Checks that line exists and hash matches
 *
 * @param lines - File content as array of lines
 * @param ref - Line reference to validate
 * @throws HashlineMismatchError if hash doesn't match
 * @throws Error if line number is out of bounds
 */
export function validateLineRef(lines: string[], ref: string): void {
  const { line, hash } = parseLineRefWithHint(ref, lines);

  if (line < 1 || line > lines.length) {
    throw new Error(`Line number ${line} out of bounds. File has ${lines.length} lines.`);
  }

  const content = lines[line - 1];
  const currentHash = computeLineHash(line, content);

  if (currentHash !== hash) {
    throw new HashlineMismatchError([{ line, expected: hash }], lines);
  }
}

/**
 * Error thrown when line reference hash doesn't match current file content
 * Includes remapping suggestions for updated hashes
 */
export class HashlineMismatchError extends Error {
  /** Map from old refs to new refs for automatic correction */
  readonly remaps: ReadonlyMap<string, string>;

  constructor(
    private readonly mismatches: HashMismatch[],
    private readonly fileLines: string[],
  ) {
    super(HashlineMismatchError.formatMessage(mismatches, fileLines));
    this.name = "HashlineMismatchError";

    // Build remapping table
    const remaps = new Map<string, string>();
    for (const mismatch of mismatches) {
      const actual = computeLineHash(mismatch.line, fileLines[mismatch.line - 1] ?? "");
      remaps.set(`${mismatch.line}#${mismatch.expected}`, `${mismatch.line}#${actual}`);
    }
    this.remaps = remaps;
  }

  /**
   * Format error message with context and updated line references
   */
  static formatMessage(mismatches: HashMismatch[], fileLines: string[]): string {
    const mismatchByLine = new Map<number, HashMismatch>();
    for (const mismatch of mismatches) {
      mismatchByLine.set(mismatch.line, mismatch);
    }

    // Collect lines to display (mismatches + context)
    const displayLines = new Set<number>();
    for (const mismatch of mismatches) {
      const low = Math.max(1, mismatch.line - MISMATCH_CONTEXT);
      const high = Math.min(fileLines.length, mismatch.line + MISMATCH_CONTEXT);
      for (let line = low; line <= high; line++) {
        displayLines.add(line);
      }
    }

    const sortedLines = [...displayLines].sort((a, b) => a - b);
    const output: string[] = [];

    output.push(
      `${mismatches.length} line${mismatches.length > 1 ? "s have" : " has"} changed since last read. ` +
        "Use updated {line_number}#{hash_id} references below (>>> marks changed lines).",
    );
    output.push("");

    let previousLine = -1;
    for (const line of sortedLines) {
      if (previousLine !== -1 && line > previousLine + 1) {
        output.push("    ...");
      }
      previousLine = line;

      const content = fileLines[line - 1] ?? "";
      const hash = computeLineHash(line, content);
      const prefix = `${line}#${hash}|${content}`;

      if (mismatchByLine.has(line)) {
        output.push(`>>> ${prefix}`);
      } else {
        output.push(`    ${prefix}`);
      }
    }

    return output.join("\n");
  }
}

/**
 * Parse line reference with suggestion for common mistakes
 *
 * @param ref - Reference string to parse
 * @param lines - File content for hash suggestion
 * @returns Parsed LineRef
 * @throws Error with suggestion if parsing fails
 */
function parseLineRefWithHint(ref: string, lines: string[]): LineRef {
  try {
    return parseLineRef(ref);
  } catch (error) {
    // Try to suggest correct line based on hash
    const suggestion = suggestLineForHash(ref, lines);
    if (suggestion) {
      throw new Error(`${(error as Error).message} ${suggestion}`);
    }
    throw error;
  }
}

/**
 * Suggest a line number based on hash match
 * Used when user provides hash but wrong line number
 *
 * @param ref - Reference string containing hash
 * @param lines - File content to search
 * @returns Suggestion string or null if no match found
 */
function suggestLineForHash(ref: string, lines: string[]): string | null {
  const hashMatch = ref.trim().match(/#([ZPMQVRWSNKTXJBYH]{2})$/);
  if (!hashMatch) return null;

  const hash = hashMatch[1];
  for (let i = 0; i < lines.length; i++) {
    if (computeLineHash(i + 1, lines[i]) === hash) {
      return `Did you mean "${i + 1}#${hash}"?`;
    }
  }
  return null;
}
