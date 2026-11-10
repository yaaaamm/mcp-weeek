import { readFile } from "node:fs/promises";
import path from "node:path";
import { McpWeeekError, asMcpWeeekError } from "../errors.js";
import { parseBoardUrl } from "./board-url.js";
import { projectConfigSchema } from "./schema.js";
export async function loadProjectConfig(configPath) {
    const absolutePath = path.resolve(configPath);
    let text;
    try {
        text = await readFile(absolutePath, "utf8");
    }
    catch (error) {
        throw asMcpWeeekError(error, "CONFIG_NOT_FOUND", `Could not read project config: ${absolutePath}`);
    }
    let raw;
    try {
        raw = JSON.parse(text);
    }
    catch (error) {
        throw new McpWeeekError("CONFIG_INVALID", "Project config is not valid JSON.", {
            cause: error,
        });
    }
    const parsed = projectConfigSchema.safeParse(raw);
    if (!parsed.success) {
        const detail = parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
            .join("; ");
        throw new McpWeeekError("CONFIG_INVALID", `Project config is invalid: ${detail}`);
    }
    return {
        path: absolutePath,
        rootDir: path.dirname(absolutePath),
        config: parsed.data,
        binding: parseBoardUrl(parsed.data.boardUrl),
    };
}
