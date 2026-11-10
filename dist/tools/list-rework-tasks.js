import { z } from "zod";
import { ROLE_COLUMN_NAMES } from "../constants.js";
import { fetchAllTasks } from "./fetch-all-tasks.js";
import { compactIncompleteTasks } from "./task-list-format.js";
export async function listReworkTasks(context, boardId) {
    const [boardColumnId, claimColumnId] = await Promise.all([
        context.boardSchema.resolveRoleColumnId(boardId, "AI_REWORK"),
        context.boardSchema.resolveRoleColumnId(boardId, "AI_IN_PROGRESS"),
    ]);
    const response = await fetchAllTasks(context.weeek, { boardId, boardColumnId });
    const tasks = compactIncompleteTasks(response.tasks);
    return {
        boardId,
        role: "AI_REWORK",
        name: ROLE_COLUMN_NAMES.AI_REWORK,
        boardColumnId,
        totalRework: tasks.length,
        truncated: response.truncated,
        tasks,
        nextSteps: {
            read: "weeek_get_task({ taskId })  // feedback + ИИ-диалог",
            claim: `weeek_move_task({ taskId, role: "AI_IN_PROGRESS" })  // ИИ в работе (col ${claimColumnId})`,
            finish: "weeek_finish_task({ taskId, report })  // обновить отчёт + вернуть на проверку",
        },
    };
}
export function registerListReworkTasks(server, context) {
    server.registerTool("weeek_list_rework_tasks", {
        title: "List tasks returned to AI for rework",
        description: "Read the separate 'Доработать ИИ' queue (role AI_REWORK). Use it only for implementations that a human reviewed and returned with feedback. Read the task, claim it via AI_IN_PROGRESS, correct and verify it, then call weeek_finish_task to update ИИ-отчёт and return it to AWAITING_RELEASE in one update.",
        inputSchema: {
            boardId: z
                .number()
                .default(context.boardId)
                .describe(`Board ID. Defaults to ${context.boardId}.`),
        },
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ boardId }) => ({
        content: [
            {
                type: "text",
                text: JSON.stringify(await listReworkTasks(context, boardId), null, 2),
            },
        ],
    }));
}
