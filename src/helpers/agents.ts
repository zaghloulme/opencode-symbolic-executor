import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

export async function installAgents(): Promise<void> {
  const agentDir = path.join(os.homedir(), ".config/opencode/agents");
  const templateDir = path.join(CURRENT_DIR, "../../.opencode/templates/agents");

  const agents = ["symb-plan", "symb-build", "symb-chat"];

  await fs.mkdir(agentDir, { recursive: true });

  for (const agent of agents) {
    const agentPath = path.join(agentDir, `${agent}.md`);
    const templatePath = path.join(templateDir, `${agent}.md`);

    try {
      await fs.access(agentPath);
      continue;
    } catch {
      // File doesn't exist, proceed
    }

    try {
      const template = await fs.readFile(templatePath, "utf-8");
      await fs.writeFile(agentPath, template, "utf-8");
    } catch {
      // Silent fail - agents are optional
    }
  }
}
