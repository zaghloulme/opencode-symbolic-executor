import * as fs from "node:fs/promises";
import * as path from "node:path";

export async function generateSPECId(directory: string): Promise<string> {
  const indexPath = path.join(directory, ".opencode/SPEC-INDEX.md");

  try {
    const indexContent = await fs.readFile(indexPath, "utf-8");
    const matches = indexContent.match(/SPEC-(\d+)/g);

    if (matches && matches.length > 0) {
      const lastId = parseInt(matches[matches.length - 1].replace("SPEC-", ""));
      return String(lastId + 1).padStart(3, "0");
    }
  } catch {
    // Index doesn't exist yet
  }

  return "001";
}

export async function updateSPECIndex(
  directory: string,
  specId: string,
  feature: string | null,
  requirementsCount?: number,
): Promise<void> {
  const indexPath = path.join(directory, ".opencode/SPEC-INDEX.md");
  const today = new Date().toISOString().split("T")[0];

  try {
    let indexContent = await fs.readFile(indexPath, "utf-8");

    const tableRowRegex = new RegExp(`\\| SPEC-${specId} \\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\|`);
    const existingRow = indexContent.match(tableRowRegex);

    if (existingRow && requirementsCount !== undefined) {
      const newRow = existingRow[0].replace(/(\| SPEC-\d+ \|[^|]+\|[^|]+\|)\d+(\|[^|]+\|)/, `$1${requirementsCount}$2`);
      indexContent = indexContent.replace(tableRowRegex, newRow);
    } else if (feature && !existingRow) {
      const newEntry = `| SPEC-${specId} | ${feature} | draft | 1 | ${today} |`;

      if (indexContent.includes("| SPEC-")) {
        indexContent = indexContent.replace(
          /(\| ID \| Feature \| Status \| Iteration \| Last Updated \|)/,
          `$1\n${newEntry}`,
        );
      } else {
        indexContent = `# SPEC Index\n\n| ID | Feature | Status | Iteration | Last Updated |\n|----|---------|--------|-----------|--------------|
${newEntry}\n\n## Active SPECs\n\n## Archived SPECs\n`;
      }
    }

    await fs.writeFile(indexPath, indexContent, "utf-8");
  } catch {
    const indexContent = `# SPEC Index\n\n| ID | Feature | Status | Iteration | Last Updated |\n|----|---------|--------|-----------|--------------|
| SPEC-${specId} | ${feature || "Unknown"} | draft | 1 | ${today} |\n\n## Active SPECs\n\n## Archived SPECs\n`;
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(indexPath, indexContent, "utf-8");
  }
}
