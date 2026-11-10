import { McpWeeekError } from "../errors.js";
import type { ClientChangeStatus } from "./types.js";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

export function renderCodexConfig(
  text: string,
  serverName: string,
  executablePath: string,
  args: string[]
): { after: string; status: ClientChangeStatus } {
  if (!/^[A-Za-z0-9_-]+$/.test(serverName)) {
    throw new McpWeeekError(
      "CONFIG_INVALID",
      "Codex MCP server name may contain only letters, digits, underscore, and hyphen."
    );
  }
  const start = `# >>> mcp-weeek managed: ${serverName}`;
  const end = `# <<< mcp-weeek managed: ${serverName}`;
  const block = [
    start,
    `[mcp_servers.${serverName}]`,
    `command = ${tomlString(executablePath)}`,
    `args = [${args.map(tomlString).join(", ")}]`,
    end,
  ].join("\n");
  const managedPattern = new RegExp(
    `${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`
  );
  const existingManaged = managedPattern.exec(text)?.[0];
  if (existingManaged) {
    return {
      after: text.replace(managedPattern, block),
      status: existingManaged === block ? "unchanged" : "updated",
    };
  }
  const tablePattern = new RegExp(`^\\s*\\[mcp_servers\\.${escapeRegex(serverName)}\\]`, "m");
  if (tablePattern.test(text)) {
    throw new McpWeeekError(
      "CLIENT_CONFIG_CONFLICT",
      `Codex MCP server name "${serverName}" is already managed outside mcp-weeek.`
    );
  }
  const prefix = text.length === 0 ? "" : text.endsWith("\n") ? `${text}\n` : `${text}\n\n`;
  return { after: `${prefix}${block}\n`, status: "added" };
}
