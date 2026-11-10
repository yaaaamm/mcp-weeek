import { createBoardSchema, type BoardSchema } from "./board-schema.js";
import type { LoadedProjectConfig } from "./config/load.js";
import type { IntakeField } from "./config/schema.js";
import { createWeeekClient, type WeeekClient } from "./weeek-client.js";

export type ServerContext = {
  configPath: string;
  projectRoot: string;
  workspaceId: number;
  projectId: number;
  boardId: number;
  intakeFields: IntakeField[];
  weeek: WeeekClient;
  boardSchema: BoardSchema;
};

export function createServerContext(
  loaded: LoadedProjectConfig,
  token: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch
): ServerContext {
  const weeek = createWeeekClient({ token, fetch: fetchImpl });
  return {
    configPath: loaded.path,
    projectRoot: loaded.rootDir,
    workspaceId: loaded.binding.workspaceId,
    projectId: loaded.binding.projectId,
    boardId: loaded.binding.boardId,
    intakeFields: loaded.config.intakeFields ?? [],
    weeek,
    boardSchema: createBoardSchema(weeek),
  };
}
