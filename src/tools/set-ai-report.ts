import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";

export function registerSetAiReport(server: McpServer, context: ServerContext) {
  server.registerTool(
    "weeek_set_ai_report",
    {
      title: "Write ИИ-отчёт into task custom field",
      description:
        "Write an AI completion report into the 'ИИ-отчёт' text custom field on a task. The field id is resolved BY NAME on the board — just pass taskId + report. Use this instead of description/comments — Weeek public API v1 can't update description or add comments, but custom field values CAN be set via PUT with flat map {customFields: {fieldId: value}}.",
      inputSchema: {
        taskId: z.number().describe("Task ID"),
        report: z
          .string()
          .describe(
            "Report text — concise summary of changes, files touched, verdict (плейн-текст, без HTML)"
          ),
        boardId: z
          .number()
          .default(context.boardId)
          .describe(`Board ID for resolving the 'ИИ-отчёт' field. Defaults to ${context.boardId}.`),
        customFieldId: z
          .string()
          .optional()
          .describe("Explicit 'ИИ-отчёт' field UUID. Optional — resolved by name from boardId if omitted."),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ taskId, report, boardId, customFieldId }) => {
      const fieldId =
        customFieldId ??
        (await context.boardSchema.resolveAiReportFieldId(boardId, taskId));
      const res = await context.weeek.put(`/tm/tasks/${taskId}`, {
        customFields: { [fieldId]: report },
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(res, null, 2) }],
      };
    }
  );
}
