import path from "node:path";
import type { ClientName } from "./types.js";

export type ClientPathOptions = {
  projectRoot: string;
  homeDir: string;
  platform: NodeJS.Platform;
  appDataDir?: string;
};

export function clientConfigPath(client: ClientName, options: ClientPathOptions): string {
  if (client === "codex") return path.join(options.projectRoot, ".codex", "config.toml");
  if (client === "claude-code") return path.join(options.projectRoot, ".mcp.json");
  if (client === "antigravity") {
    return path.join(options.projectRoot, ".agents", "mcp_config.json");
  }
  if (options.platform === "darwin") {
    return path.join(
      options.homeDir,
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json"
    );
  }
  if (options.platform === "win32") {
    return path.join(
      options.appDataDir ?? path.join(options.homeDir, "AppData", "Roaming"),
      "Claude",
      "claude_desktop_config.json"
    );
  }
  return path.join(
    options.homeDir,
    ".config",
    "Claude",
    "claude_desktop_config.json"
  );
}
