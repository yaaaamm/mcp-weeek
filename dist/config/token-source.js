import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";
import { McpWeeekError } from "../errors.js";
function requireToken(value, source) {
    const token = value?.trim();
    if (!token) {
        throw new McpWeeekError("TOKEN_NOT_FOUND", `Token variable was not found in ${source}.`);
    }
    return token;
}
export async function resolveToken(loaded, env = process.env) {
    const auth = loaded.config.auth;
    if (auth.source === "env") {
        return requireToken(env[auth.variable], `environment variable ${auth.variable}`);
    }
    const envPath = path.resolve(loaded.rootDir, auth.file);
    let text;
    try {
        text = await readFile(envPath, "utf8");
    }
    catch (error) {
        throw new McpWeeekError("TOKEN_NOT_FOUND", `Could not read token source: ${envPath}`, {
            cause: error,
        });
    }
    const values = parse(text);
    return requireToken(values[auth.variable], `${envPath}:${auth.variable}`);
}
