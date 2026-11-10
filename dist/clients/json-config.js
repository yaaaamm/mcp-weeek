import { McpWeeekError } from "../errors.js";
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isPackageEntrypoint(value) {
    const normalized = value.replaceAll("\\", "/");
    const basename = normalized.split("/").at(-1)?.replace(/\.(cmd|exe)$/i, "");
    return (basename === "mcp-weeek" ||
        normalized.endsWith("/mcp-weeek/dist/cli.js"));
}
function isManagedEntry(value) {
    if (!isObject(value) || typeof value.command !== "string")
        return false;
    return (isPackageEntrypoint(value.command) ||
        (Array.isArray(value.args) &&
            value.args.some((argument) => typeof argument === "string" && isPackageEntrypoint(argument))));
}
function equalJson(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
export function renderJsonMcpConfig(text, serverName, entry) {
    let root;
    try {
        const parsed = text.trim() ? JSON.parse(text) : {};
        if (!isObject(parsed))
            throw new Error("Root must be an object");
        root = parsed;
    }
    catch (error) {
        throw new McpWeeekError("CONFIG_INVALID", "MCP client config is not valid JSON.", {
            cause: error,
        });
    }
    const rawServers = root.mcpServers;
    if (rawServers !== undefined && !isObject(rawServers)) {
        throw new McpWeeekError("CONFIG_INVALID", "mcpServers must be a JSON object.");
    }
    const servers = rawServers ?? {};
    const existing = servers[serverName];
    if (existing !== undefined && !isManagedEntry(existing)) {
        throw new McpWeeekError("CLIENT_CONFIG_CONFLICT", `MCP server name "${serverName}" is already used by another command.`);
    }
    const status = existing === undefined ? "added" : equalJson(existing, entry) ? "unchanged" : "updated";
    servers[serverName] = entry;
    root.mcpServers = servers;
    return { after: JSON.stringify(root, null, 2) + "\n", status };
}
