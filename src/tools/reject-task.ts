import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";

export function registerRejectTask(server: McpServer, context: ServerContext) {
  server.registerTool(
    "weeek_reject_task",
    {
      title: "Reject Weeek task as not reproducible / already resolved",
      description:
        "Terminal action for tasks where code review shows the reported bug does not occur (already fixed, misunderstood, duplicate, stale). Atomically writes the verification report into the 'ИИ-отчёт' custom field AND moves the task to the 'Подтвердить (у меня нет такой ошибки)' column (resolved by name) for user confirmation. Both the field id and the column id are resolved by name on the board — just pass taskId + report. Use this instead of weeek_move_task→AI_DONE when NO code changes are made because the bug doesn't reproduce. If the board lacks the 'Подтвердить' column, run weeek_init_board() — it is part of the required schema.",
      inputSchema: {
        taskId: z.number().describe("Task ID to reject"),
        report: z
          .string()
          .describe(
            "Plain-text verification report — what was checked (files, behaviour) and why the bug does NOT reproduce. Must be concrete, not generic."
          ),
        boardId: z
          .number()
          .default(context.boardId)
          .describe(`Board ID for resolving the field + column. Defaults to ${context.boardId}.`),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ taskId, report, boardId }) => {
      const [customFieldId, boardColumnId] = await Promise.all([
        context.boardSchema.resolveAiReportFieldId(boardId, taskId),
        context.boardSchema.resolveRoleColumnId(boardId, "REJECT_CONFIRM"),
      ]);
      const res = await context.weeek.put(`/tm/tasks/${taskId}`, {
        customFields: { [customFieldId]: report },
        boardColumnId,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(res, null, 2) }],
      };
    }
  );
}
