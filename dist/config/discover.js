import { access } from "node:fs/promises";
import path from "node:path";
import { McpWeeekError } from "../errors.js";
const CONFIG_FILE = ".weeek-mcp.json";
async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
export async function discoverConfig(startDirectory, env = process.env) {
    if (env.MCP_WEEEK_CONFIG) {
        const explicit = path.resolve(startDirectory, env.MCP_WEEEK_CONFIG);
        if (await exists(explicit))
            return explicit;
        throw new McpWeeekError("CONFIG_NOT_FOUND", `MCP_WEEEK_CONFIG does not exist: ${explicit}`);
    }
    let current = path.resolve(startDirectory);
    while (true) {
        const candidate = path.join(current, CONFIG_FILE);
        if (await exists(candidate))
            return candidate;
        const parent = path.dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    throw new McpWeeekError("CONFIG_NOT_FOUND", `Could not find ${CONFIG_FILE} from ${path.resolve(startDirectory)}.`);
}
