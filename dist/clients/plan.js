import { readFile } from "node:fs/promises";
import { renderCodexConfig } from "./codex.js";
import { renderJsonMcpConfig } from "./json-config.js";
import { clientConfigPath } from "./paths.js";
async function readOptional(filePath) {
    try {
        return await readFile(filePath, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT")
            return "";
        throw error;
    }
}
export async function planClientChanges(options) {
    const changes = [];
    for (const client of options.clients) {
        const filePath = clientConfigPath(client, options);
        const before = await readOptional(filePath);
        const desktop = client === "claude-desktop";
        const baseArgs = [...(options.commandArgsPrefix ?? []), "serve"];
        const args = desktop ? [...baseArgs, "--config", options.configPath] : baseArgs;
        let rendered;
        if (client === "codex") {
            rendered = renderCodexConfig(before, options.serverName, options.executablePath, args);
        }
        else {
            const entry = {
                ...(client === "antigravity" ? {} : { type: "stdio" }),
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
