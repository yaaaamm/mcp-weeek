import { McpWeeekError } from "../errors.js";
import { createWeeekClient } from "../weeek-client.js";
export async function validateBoardAccess(input) {
    const client = createWeeekClient({ token: input.token, fetch: input.fetch });
    let response;
    try {
        response = await client.get("/tm/boards", { projectId: input.binding.projectId });
    }
    catch (error) {
        throw new McpWeeekError("WEEEK_AUTH_FAILED", "Could not authenticate to Weeek.", {
            cause: error,
        });
    }
    const boards = response.boards ?? [];
    if (!boards.some((board) => board.id === input.binding.boardId)) {
        throw new McpWeeekError("BOARD_NOT_FOUND", `Board ${input.binding.boardId} was not found in project ${input.binding.projectId}.`);
    }
}
