import { McpWeeekError } from "../errors.js";

export type BoardBinding = {
  workspaceId: number;
  projectId: number;
  boardId: number;
  boardUrl: string;
};

const BOARD_PATH = /^\/ws\/(\d+)\/project\/(\d+)\/board\/(\d+)\/?$/;

function positiveInteger(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new McpWeeekError("CONFIG_INVALID", `${field} must be a positive integer.`);
  }
  return parsed;
}

export function parseBoardUrl(value: string): BoardBinding {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new McpWeeekError("CONFIG_INVALID", "boardUrl must be a valid URL.", {
      cause: error,
    });
  }

  if (url.protocol !== "https:" || url.hostname !== "app.weeek.net") {
    throw new McpWeeekError(
      "CONFIG_INVALID",
      "boardUrl must use https://app.weeek.net."
    );
  }

  const match = BOARD_PATH.exec(url.pathname);
  if (!match || url.search || url.hash) {
    throw new McpWeeekError(
      "CONFIG_INVALID",
      "boardUrl must match /ws/<workspaceId>/project/<projectId>/board/<boardId>."
    );
  }

  const workspaceId = positiveInteger(match[1], "workspaceId");
  const projectId = positiveInteger(match[2], "projectId");
  const boardId = positiveInteger(match[3], "boardId");

  return {
    workspaceId,
    projectId,
    boardId,
    boardUrl: `https://app.weeek.net/ws/${workspaceId}/project/${projectId}/board/${boardId}`,
  };
}
