import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";
import { fetchAllTasks } from "./fetch-all-tasks.js";
import { compactIncompleteTasks } from "./task-list-format.js";

export async function listPendingTasks(
  context: ServerContext,
  boardId: number
) {
  const sources = [
    { role: "SOURCE_ERRORS" as const, name: "Ошибки" },
    { role: "SOURCE_IMPROVEMENTS" as const, name: "Доработки" },
  ];
  const sourceIds = await Promise.all(
    sources.map((source) =>
      context.boardSchema.resolveRoleColumnId(boardId, source.role)
    )
  );
  const claimColumnId = await context.boardSchema.resolveRoleColumnId(
    boardId,
    "AI_IN_PROGRESS"
  );
  const responses = await Promise.all(
    sourceIds.map((boardColumnId) =>
      fetchAllTasks(context.weeek, { boardId, boardColumnId })
    )
  );
  const columns = sourceIds.map((boardColumnId, index) => {
    const tasks = compactIncompleteTasks(responses[index].tasks);
    return {
      role: sources[index].role,
      name: sources[index].name,
      boardColumnId,
      count: tasks.length,
      // true = упёрлись в предохранитель пагинации, очередь показана НЕ целиком
      truncated: responses[index].truncated,
      tasks,
    };
  });

  return {
    boardId,
    totalPending: columns.reduce((sum, column) => sum + column.count, 0),
    columns,
    nextSteps: {
      claim: `weeek_move_task({ taskId, role: "AI_IN_PROGRESS" })  // ИИ в работе (col ${claimColumnId})`,
      read: "weeek_get_task({ taskId })  // full details + execution rules",
      finish:
        "weeek_finish_task({ taskId, report })  // ИИ-отчёт + Ожидает релиза in one update",
    },
  };
}

export function registerListPendingTasks(server: McpServer, context: ServerContext) {
  server.registerTool(
    "weeek_list_pending_tasks",
    {
      title: "List pending tasks awaiting AI work",
      description:
        "Single-call entry point for the 'take next task' workflow on the feedback board. Fetches tasks from the source columns ('Ошибки' + 'Доработки', resolved by name) on the given board and returns a compact list with resolved custom-field names (no option UUIDs). Prefer this over raw curl or multiple weeek_list_tasks calls.",
      inputSchema: {
        boardId: z
          .number()
          .default(context.boardId)
          .describe(
            `Board ID. Defaults to ${context.boardId} (this instance's board).`
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ boardId }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(await listPendingTasks(context, boardId), null, 2),
        },
      ],
    })
  );
}
