import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED_AGENTS = ["symb-plan", "symb-build", "symb-chat"];

const OPENCODE_BUILTIN_AGENTS = ["build", "plan", "chat"];

/**
 * Merge into global OpenCode config to disable built-in primary agents
 * so only symb-* agents appear. Sets default_agent to symb-build.
 */
async function disableBuiltInAgents(): Promise<void> {
  const configPath = path.join(os.homedir(), ".config/opencode/opencode.json");
  let config: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") config = parsed as Record<string, unknown>;
  } catch {
    return;
  }

  if (!config.agent || typeof config.agent !== "object") {
    config.agent = {} as Record<string, unknown>;
  }
  const agent = config.agent as Record<string, Record<string, unknown>>;

  for (const name of OPENCODE_BUILTIN_AGENTS) {
    if (!agent[name]) agent[name] = {};
    agent[name].disable = true;
  }

  config.default_agent = "symb-build";

  try {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch {
    // Silent fail
  }
}

export async function installAgents(): Promise<void> {
  const agentDir = path.join(os.homedir(), ".config/opencode/agents");
  const templateDir = path.join(CURRENT_DIR, "../../.opencode/templates/agents");

  await fs.mkdir(agentDir, { recursive: true });

  // Disable OpenCode built-in agents (build, plan, chat) so only symb-* show
  await disableBuiltInAgents();

  // Prune: remove any agent file not in the allowed list (no default/spec-* agents)
  const allowedSet = new Set(ALLOWED_AGENTS);
  try {
    const entries = await fs.readdir(agentDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith(".md")) continue;
      const name = ent.name.slice(0, -3);
      if (!allowedSet.has(name)) {
        await fs.unlink(path.join(agentDir, ent.name));
      }
    }
  } catch {
    // Ignore readdir errors
  }

  // Install or update allowed agents from templates
  for (const agent of ALLOWED_AGENTS) {
    const agentPath = path.join(agentDir, `${agent}.md`);
    const templatePath = path.join(templateDir, `${agent}.md`);

    try {
      const template = await fs.readFile(templatePath, "utf-8");
      await fs.writeFile(agentPath, template, "utf-8");
    } catch {
      // Silent fail - agents are optional
    }
  }
}
