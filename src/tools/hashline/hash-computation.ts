/**
 * Hash computation for hashline edit tool
 * Based on oh-my-pi / oh-my-openagent implementation
 */

import { createHash } from "node:crypto";
import { HASHLINE_ALPHABET } from "./constants";

/**
 * Regex to detect significant characters (letters, numbers)
 * Used to determine if line should use seed=0 or seed=lineNumber
 */
const RE_SIGNIFICANT = /[\p{L}\p{N}]/u;

/**
 * Compute 2-character hash for a line of code
 * Uses xxHash-like algorithm with line number as seed for whitespace-only lines
 *
 * @param lineNumber - 1-based line number
 * @param content - Line content (without newline)
 * @returns 2-character hash from HASHLINE_ALPHABET
 */
export function computeLineHash(lineNumber: number, content: string): string {
  // Normalize whitespace and handle CRLF
  const normalized = content.endsWith("\r") ? content.slice(0, -1).replace(/\s+/g, "") : content.replace(/\s+/g, "");

  // Use line number as seed for whitespace-only lines
  const seed = RE_SIGNIFICANT.test(normalized) ? 0 : lineNumber;

  // Compute hash using Node.js crypto (xxHash32-like)
  const hashInput = `${seed}:${normalized}`;
  const hash = createHash("sha256").update(hashInput).digest("hex");
  const hashInt = Number.parseInt(hash.slice(0, 8), 16);
  const h = Math.abs(hashInt);
  const alphabetLen = HASHLINE_ALPHABET.length;
  const idx1 = h % alphabetLen;
  const idx2 = Math.floor(h / alphabetLen) % alphabetLen;

  return HASHLINE_ALPHABET[idx1] + HASHLINE_ALPHABET[idx2];
}

/**
 * Format a single line with hash prefix: LINE#ID|content
 *
 * @param lineNumber - 1-based line number
 * @param content - Line content (without newline)
 * @returns Formatted string: "11#VK| function hello() {"
 */
export function formatHashLine(lineNumber: number, content: string): string {
  const hash = computeLineHash(lineNumber, content);
  return `${lineNumber}#${hash}|${content}`;
}

/**
 * Format entire file content with hash prefixes on all lines
 *
 * @param content - File content (may include newlines)
 * @returns Formatted content with LINE#ID| on each line
 */
export function formatHashLines(content: string): string {
  if (!content) return "";

  const lines = content.split("\n");
  return lines.map((line, index) => formatHashLine(index + 1, line)).join("\n");
}

/**
 * Options for streaming hashline formatter
 */
export interface HashlineStreamOptions {
  /** Starting line number (default: 1) */
  startLine?: number;
  /** Maximum lines per chunk (default: 200) */
  maxChunkLines?: number;
  /** Maximum bytes per chunk (default: 64KB) */
  maxChunkBytes?: number;
}

/**
 * Stream hashline formatter for large files
 * Processes UTF-8 stream and yields hashline-formatted chunks
 *
 * @param source - UTF-8 byte stream (ReadableStream or AsyncIterable)
 * @param options - Streaming options
 * @returns Async generator yielding hashline-formatted string chunks
 */
export async function* streamHashLinesFromUtf8(
  source: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
  options: HashlineStreamOptions = {},
): AsyncGenerator<string> {
  const startLine = options.startLine ?? 1;
  const maxChunkLines = options.maxChunkLines ?? 200;
  const maxChunkBytes = options.maxChunkBytes ?? 64 * 1024;

  const decoder = new TextDecoder("utf-8");
  const chunks = isReadableStream(source) ? bytesFromReadableStream(source) : source;

  let lineNumber = startLine;
  let pending = "";
  let sawAnyText = false;
  let endedWithNewline = false;

  const chunkFormatter = createHashlineChunkFormatter({ maxChunkLines, maxChunkBytes });

  const pushLine = (line: string): string[] => {
    const formatted = formatHashLine(lineNumber, line);
    lineNumber += 1;
    return chunkFormatter.push(formatted);
  };

  const consumeText = (text: string): string[] => {
    if (text.length === 0) return [];
    sawAnyText = true;
    pending += text;
    const chunksToYield: string[] = [];

    while (true) {
      const idx = pending.indexOf("\n");
      if (idx === -1) break;
      const line = pending.slice(0, idx);
      pending = pending.slice(idx + 1);
      endedWithNewline = true;
      chunksToYield.push(...pushLine(line));
    }

    if (pending.length > 0) endedWithNewline = false;
    return chunksToYield;
  };

  for await (const chunk of chunks) {
    for (const out of consumeText(decoder.decode(chunk, { stream: true }))) {
      yield out;
    }
  }

  for (const out of consumeText(decoder.decode())) {
    yield out;
  }

  const final = chunkFormatter.flush();
  if (final) yield final;

  if (!sawAnyText) {
    yield "";
  }
}

/**
 * Check if value is a ReadableStream
 */
function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return (
    typeof value === "object" &&
    value !== null &&
    "getReader" in value &&
    typeof (value as { getReader?: unknown }).getReader === "function"
  );
}

/**
 * Convert ReadableStream to AsyncIterable
 */
async function* bytesFromReadableStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Chunk formatter for streaming hashline output
 * Manages chunk boundaries based on line count and byte size
 */
interface HashlineChunkFormatter {
  push(formattedLine: string): string[];
  flush(): string | undefined;
}

interface HashlineChunkFormatterOptions {
  maxChunkLines: number;
  maxChunkBytes: number;
}

function createHashlineChunkFormatter(options: HashlineChunkFormatterOptions): HashlineChunkFormatter {
  const { maxChunkLines, maxChunkBytes } = options;
  let outputLines: string[] = [];
  let outputBytes = 0;

  const flush = (): string | undefined => {
    if (outputLines.length === 0) return undefined;
    const result = outputLines.join("\n");
    outputLines = [];
    outputBytes = 0;
    return result;
  };

  const push = (formattedLine: string): string[] => {
    const chunks: string[] = [];

    // Check if adding this line would exceed limits
    const newBytes = formattedLine.length + (outputLines.length > 0 ? 1 : 0);
    const wouldExceedLines = outputLines.length >= maxChunkLines;
    const wouldExceedBytes = outputBytes + newBytes > maxChunkBytes;

    if (wouldExceedLines || wouldExceedBytes) {
      const flushed = flush();
      if (flushed) chunks.push(flushed);
    }

    outputLines.push(formattedLine);
    outputBytes += newBytes;
    return chunks;
  };

  return { push, flush };
}
