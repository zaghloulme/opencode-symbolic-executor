import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { BM25Engine } from "./bm25";
import type { DehydratedTool, SearchResult } from "./types";

export class ToolRegistry {
  private tools: DehydratedTool[] = [];
  private engine: BM25Engine | null = null;

  private constructor(private registryDir: string) {}

  static async create(registryDir: string): Promise<ToolRegistry> {
    const registry = new ToolRegistry(registryDir);
    await registry.loadRegistry();
    return registry;
  }

  private async loadRegistry(): Promise<void> {
    try {
      await fs.access(this.registryDir);
    } catch {
      return;
    }

    await this.scanDir(this.registryDir);
    this.engine = new BM25Engine(this.tools);
  }

  private async scanDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) {
        try {
          const content = await fs.readFile(fullPath, "utf8");
          const tool = yaml.load(content) as DehydratedTool;
          if (tool?.name && tool?.server) {
            this.tools.push(tool);
          }
        } catch {
          // Skip malformed YAML files
        }
      }
    }
  }

  search(query: string, limit = 5): SearchResult[] {
    if (!this.engine) return [];
    return this.engine.search(query, limit);
  }

  getTool(name: string): DehydratedTool | undefined {
    return this.tools.find((t) => t.name === name);
  }

  getAllNames(): string[] {
    return this.tools.map((t) => t.name);
  }

  getToolsByServer(server: string): DehydratedTool[] {
    return this.tools.filter((t) => t.server === server);
  }
}
