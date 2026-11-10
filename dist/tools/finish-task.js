import { z } from "zod";
import { ROLE_COLUMN_NAMES } from "../constants.js";
import { McpWeeekError } from "../errors.js";
export async function finishTask(context, input) {
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
export function registerFinishTask(server, context) {
    server.registerTool("weeek_finish_task", {
        title: "Finish implemented Weeek task",
        description: "Required final step after successful implementation and verification. " +
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
    }, async ({ taskId, report, boardId }) => ({
        content: [
            {
                type: "text",
                text: JSON.stringify(await finishTask(context, { taskId, report, boardId }), null, 2),
            },
        ],
    }));
}
