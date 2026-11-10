import { readFile } from "node:fs/promises";
import { renderCodexConfig } from "./codex.js";
import { renderJsonMcpConfig } from "./json-config.js";
import { clientConfigPath } from "./paths.js";
import type { ClientChange, ClientName, StdioEntry } from "./types.js";

export type PlanClientChangesOptions = {
  clients: readonly ClientName[];
  projectRoot: string;
  configPath: string;
  executablePath: string;
  commandArgsPrefix?: readonly string[];
  serverName: string;
  homeDir: string;
  platform: NodeJS.Platform;
  appDataDir?: string;
  isTracked?: (filePath: string) => Promise<boolean>;
};

async function readOptional(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

export async function planClientChanges(
  options: PlanClientChangesOptions
): Promise<ClientChange[]> {
  const changes: ClientChange[] = [];
  for (const client of options.clients) {
    const filePath = clientConfigPath(client, options);
    const before = await readOptional(filePath);
    const desktop = client === "claude-desktop";
    const baseArgs = [...(options.commandArgsPrefix ?? []), "serve"];
    const args = desktop ? [...baseArgs, "--config", options.configPath] : baseArgs;
    let rendered: { after: string; status: ClientChange["status"] };
    if (client === "codex") {
      rendered = renderCodexConfig(
        before,
        options.serverName,
        options.executablePath,
        args
      );
    } else {
      const entry: StdioEntry = {
        ...(client === "antigravity" ? {} : { type: "stdio" as const }),
        command: options.executablePath,
        args,
      };
      rendered = renderJsonMcpConfig(before, options.serverName, entry);
    }
    changes.push({
      client,
      path: filePath,
      before,
      after: rendered.after,
      status: rendered.status,
      backup: desktop,
      tracked: desktop ? false : await (options.isTracked?.(filePath) ?? false),
    });
  }
  return changes;
}
