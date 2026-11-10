import path from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { discoverConfig } from "../config/discover.js";
import { loadProjectConfig, type LoadedProjectConfig } from "../config/load.js";
import { resolveToken } from "../config/token-source.js";
import { McpWeeekError } from "../errors.js";
import { createServerContext, type ServerContext } from "../server-context.js";
import { SERVER_VERSION } from "../version.js";
import { createMcpServer } from "./create-server.js";

export type LoadRuntimeOptions = {
  configPath?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  allowLegacyEnv?: boolean;
  fetch?: typeof globalThis.fetch;
};

function legacyNumber(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number
): number {
  const raw = env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new McpWeeekError("CONFIG_INVALID", `${name} must be a positive integer.`);
  }
  return value;
}

function loadLegacyConfig(cwd: string, env: NodeJS.ProcessEnv): LoadedProjectConfig {
  const boardId = legacyNumber(env, "WEEEK_BOARD_ID", 133);
  const projectId = legacyNumber(env, "WEEEK_PROJECT_ID", 1);
  const workspaceId = legacyNumber(env, "WEEEK_WORKSPACE_ID", 1);
  const boardUrl = `https://app.weeek.net/ws/${workspaceId}/project/${projectId}/board/${boardId}`;
  return {
    path: "<legacy-env>",
    rootDir: cwd,
    config: {
      version: 1,
      boardUrl,
      auth: { source: "env", variable: "WEEEK_API_TOKEN" },
    },
    binding: { workspaceId, projectId, boardId, boardUrl },
  };
}

export async function loadServerContext(
  options: LoadRuntimeOptions = {}
): Promise<ServerContext> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const env = options.env ?? process.env;
  let loaded: LoadedProjectConfig;

  if (options.configPath) {
    loaded = await loadProjectConfig(path.resolve(cwd, options.configPath));
  } else {
    try {
      loaded = await loadProjectConfig(await discoverConfig(cwd, env));
    } catch (error) {
      if (
        options.allowLegacyEnv &&
        error instanceof McpWeeekError &&
        error.code === "CONFIG_NOT_FOUND"
      ) {
        loaded = loadLegacyConfig(cwd, env);
      } else {
        throw error;
      }
    }
  }

  const token = await resolveToken(loaded, env);
  return createServerContext(loaded, token, options.fetch ?? globalThis.fetch);
}

export async function serve(options: LoadRuntimeOptions = {}): Promise<void> {
  const context = await loadServerContext(options);
  const server = createMcpServer(context);
  await server.connect(new StdioServerTransport());
  console.error(
    `Weeek MCP server running on stdio (v${SERVER_VERSION}, board ${context.boardId})`
  );
}
