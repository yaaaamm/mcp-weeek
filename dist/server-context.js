import { createBoardSchema } from "./board-schema.js";
import { createWeeekClient } from "./weeek-client.js";
export function createServerContext(loaded, token, fetchImpl = globalThis.fetch) {
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
