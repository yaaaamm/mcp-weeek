import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ROLE_COLUMN_NAMES } from "../constants.js";
import { McpWeeekError } from "../errors.js";
import type { ServerContext } from "../server-context.js";

export type FinishTaskInput = {
  taskId: number;
  report: string;
  boardId: number;
};

export type FinishTaskResult = {
  taskId: number;
  destinationRole: "AWAITING_RELEASE";
  destinationName: string;
  boardColumnId: number;
  reportUpdated: true;
};

export async function finishTask(
  context: ServerContext,
  input: FinishTaskInput
): Promise<FinishTaskResult> {
  const report = input.report.trim();
  if (!report) {
    throw new McpWeeekError("CONFIG_INVALID", "Report must not be empty.");
  }

  const [customFieldId, boardColumnId] = await Promise.all([
    context.boardSchema.resolveAiReportFieldId(input.boardId, input.taskId),
    context.boardSchema.resolveRoleColumnId(input.boardId, "AWAITING_RELEASE"),
  ]);

  await context.weeek.put(`/tm/tasks/${input.taskId}`, {
    customFields: { [customFieldId]: report },
    boardColumnId,
  });

  return {
    taskId: input.taskId,
    destinationRole: "AWAITING_RELEASE",
    destinationName: ROLE_COLUMN_NAMES.AWAITING_RELEASE,
    boardColumnId,
    reportUpdated: true,
  };
}

export function registerFinishTask(
  server: McpServer,
  context: ServerContext
): void {
  server.registerTool(
    "weeek_finish_task",
    {
      title: "Finish implemented Weeek task",
      description:
        "Required final step after successful implementation and verification. " +
        "Writes the completion report to 'ИИ-отчёт' and moves the task to " +
        "AWAITING_RELEASE ('Ожидает релиза') in one update. Do not use for " +
        "rejection or release completion.",
      inputSchema: {
        taskId: z.number().describe("Successfully implemented task ID"),
        report: z
          .string()
          .trim()
          .min(1, "Report must not be empty")
          .describe("Concrete plain-text completion and verification report"),
        boardId: z
          .number()
          .default(context.boardId)
          .describe(`Board ID. Defaults to ${context.boardId}.`),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ taskId, report, boardId }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            await finishTask(context, { taskId, report, boardId }),
            null,
            2
          ),
        },
      ],
    })
  );
}
