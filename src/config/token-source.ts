import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";
import { McpWeeekError } from "../errors.js";
import type { LoadedProjectConfig } from "./load.js";

function requireToken(value: string | undefined, source: string): string {
  const token = value?.trim();
  if (!token) {
    throw new McpWeeekError("TOKEN_NOT_FOUND", `Token variable was not found in ${source}.`);
  }
  return token;
}

export async function resolveToken(
  loaded: LoadedProjectConfig,
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  const auth = loaded.config.auth;
  if (auth.source === "env") {
    return requireToken(env[auth.variable], `environment variable ${auth.variable}`);
  }

  const envPath = path.resolve(loaded.rootDir, auth.file);
  let text: string;
  try {
    text = await readFile(envPath, "utf8");
  } catch (error) {
    throw new McpWeeekError("TOKEN_NOT_FOUND", `Could not read token source: ${envPath}`, {
      cause: error,
    });
  }
  const values = parse(text);
  return requireToken(values[auth.variable], `${envPath}:${auth.variable}`);
}
