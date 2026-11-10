import { readFile } from "node:fs/promises";
import path from "node:path";
import { McpWeeekError, asMcpWeeekError } from "../errors.js";
import { parseBoardUrl, type BoardBinding } from "./board-url.js";
import { projectConfigSchema, type ProjectConfig } from "./schema.js";

export type LoadedProjectConfig = {
  path: string;
  rootDir: string;
  config: ProjectConfig;
  binding: BoardBinding;
};

export async function loadProjectConfig(configPath: string): Promise<LoadedProjectConfig> {
  const absolutePath = path.resolve(configPath);
  let text: string;
  try {
    text = await readFile(absolutePath, "utf8");
  } catch (error) {
    throw asMcpWeeekError(
      error,
      "CONFIG_NOT_FOUND",
      `Could not read project config: ${absolutePath}`
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
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
