import path from "node:path";
export function clientConfigPath(client, options) {
    if (client === "codex")
        return path.join(options.projectRoot, ".codex", "config.toml");
    if (client === "claude-code")
        return path.join(options.projectRoot, ".mcp.json");
    if (client === "antigravity") {
        return path.join(options.projectRoot, ".agents", "mcp_config.json");
    }
    if (options.platform === "darwin") {
        return path.join(options.homeDir, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    }
    if (options.platform === "win32") {
        return path.join(options.appDataDir ?? path.join(options.homeDir, "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
    }
    return path.join(options.homeDir, ".config", "Claude", "claude_desktop_config.json");
}
