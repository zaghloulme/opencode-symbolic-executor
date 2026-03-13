import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface ActiveSpec {
  specId: string;
  title: string;
  status: string;
  requirementsCount: number;
  tasksCount: number;
  completedTasks: number;
  pendingTasks: string[];
}

export async function scanActiveSpecs(directory: string): Promise<ActiveSpec[]> {
  const specsDir = path.join(directory, ".opencode/specs");
  try {
    const files = await fs.readdir(specsDir);
    const results: ActiveSpec[] = [];

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const content = await fs.readFile(path.join(specsDir, file), "utf-8");
      const specId = file.replace(".md", "");
      const title = content.match(/^# SPEC-\d+: (.+)$/m)?.[1] || "Untitled";
      const status =
        content
          .match(/Status:\s*(draft|in_planning|active|complete|in_progress)/i)?.[1]
          ?.toLowerCase()
          ?.replace("in_progress", "in_planning") || "draft";

      if (status === "complete") continue;

      // Extract pending (unchecked) task descriptions
      const pendingTasks: string[] = [];
      const taskMatches = content.matchAll(/- \*\*(TASK-\d+)\*\*: (.+)\n[\s\S]*?- \[ \]/g);
      for (const match of taskMatches) {
        pendingTasks.push(`${match[1]}: ${match[2]}`);
      }

      results.push({
        specId,
        title,
        status,
        requirementsCount: (content.match(/REQ-\d+/g) || []).length,
        tasksCount: (content.match(/TASK-\d+/g) || []).length,
        completedTasks: (content.match(/\[x\]/gi) || []).length,
        pendingTasks,
      });
    }

    return results;
  } catch {
    return [];
  }
}
