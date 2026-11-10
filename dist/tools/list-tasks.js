import { z } from "zod";
import { fetchAllTasks } from "./fetch-all-tasks.js";
import { compactAllTasks } from "./task-list-format.js";
export function registerListTasks(server, context) {
    server.registerTool("weeek_list_tasks", {
        title: "List Weeek tasks",
        description: "List tasks from a Weeek board, optionally filtered by column. Reads every page of /tm/tasks and returns the COMPLETE list as a compact array (id, title, boardColumnId, priority, isCompleted, resolved custom fields) plus totalCount — no pagination handling is needed on your side. A task that lives on several boards also carries `locations`: in that case the top-level boardColumnId is another board's column, so decide column membership from `locations`, never from boardColumnId alone. `truncated: true` means even the paging cap was hit and the list is incomplete. For the 'take next task' workflow on the feedback board prefer weeek_list_pending_tasks.",
        inputSchema: {
            boardId: z
                .number()
                .default(context.boardId)
                .describe(`Board ID. Defaults to ${context.boardId} (this instance's board).`),
            boardColumnId: z.number().optional().describe("Filter by column ID"),
            raw: z
                .boolean()
                .optional()
                .describe("Return the untouched Weeek response for ONE page (~20 tasks) instead of the complete compact list. Debug aid for inspecting a field the compact shape drops — it truncates silently, so never use it to enumerate a column."),
        },
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ boardId, boardColumnId, raw }) => {
        if (raw) {
            const res = await context.weeek.get("/tm/tasks", { boardId, boardColumnId });
            return {
                content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
            };
        }
        const { tasks, pagesFetched, truncated } = await fetchAllTasks(context.weeek, {
            boardId,
            boardColumnId,
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        boardId,
                        boardColumnId: boardColumnId ?? null,
                        totalCount: tasks.length,
                        pagesFetched,
                        truncated,
                        ...(truncated
                            ? {
                                note: "Paging cap reached — this list is INCOMPLETE. Narrow the filter (boardColumnId) and repeat.",
                            }
                            : {}),
                        tasks: compactAllTasks(tasks),
                    }, null, 2),
                },
            ],
        };
    });
}
