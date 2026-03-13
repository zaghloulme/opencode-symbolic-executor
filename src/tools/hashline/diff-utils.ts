/**
 * Diff utilities for hashline edit tool
 * Generates unified diff output for error/success messages
 * Based on oh-my-pi / oh-my-openagent implementation
 */

/**
 * Generate unified diff between old and new content
 *
 * @param oldContent - Original file content
 * @param newContent - Modified file content
 * @param filePath - File path for diff header
 * @returns Unified diff string
 */
export function generateHashlineDiff(oldContent: string, newContent: string, filePath: string): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  let diff = `--- ${filePath}\n+++ ${filePath}\n`;
  const maxLines = Math.max(oldLines.length, newLines.length);

  // Simple line-by-line diff (not optimal but sufficient for error messages)
  let oldLineNum = 1;
  let newLineNum = 1;
  let inHunk = false;
  let hunkOldCount = 0;
  let hunkNewCount = 0;
  const hunkLines: string[] = [];

  const flushHunk = () => {
    if (inHunk && hunkLines.length > 0) {
      diff += `@@ -${oldLineNum - hunkOldCount},${hunkOldCount} +${newLineNum - hunkNewCount},${hunkNewCount} @@\n`;
      diff += hunkLines.join("\n") + "\n";
      inHunk = false;
      hunkOldCount = 0;
      hunkNewCount = 0;
      hunkLines.length = 0;
    }
  };

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      flushHunk();
      if (oldLine !== undefined) {
        diff += ` ${oldLine}\n`;
        oldLineNum++;
        newLineNum++;
      }
    } else {
      if (!inHunk) {
        inHunk = true;
      }

      if (oldLine !== undefined) {
        hunkLines.push(`-${oldLine}`);
        hunkOldCount++;
        oldLineNum++;
      }

      if (newLine !== undefined) {
        hunkLines.push(`+${newLine}`);
        hunkNewCount++;
        newLineNum++;
      }
    }
  }

  flushHunk();
  return diff;
}

/**
 * Format a short diff snippet for error messages
 * Shows only the first few changed lines
 *
 * @param oldContent - Original content
 * @param newContent - Modified content
 * @param maxHunks - Maximum number of hunks to show
 * @returns Abbreviated diff string
 */
export function formatShortDiff(oldContent: string, newContent: string, maxHunks: number = 3): string {
  const fullDiff = generateHashlineDiff(oldContent, newContent, "file");
  const lines = fullDiff.split("\n");

  // Count hunks and truncate
  let hunkCount = 0;
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith("@@")) {
      hunkCount++;
      if (hunkCount > maxHunks) {
        result.push("...");
        break;
      }
    }
    result.push(line);
  }

  return result.join("\n");
}
