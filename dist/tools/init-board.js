import { z } from "zod";
import { ensureBoard, fieldsHiddenMessage } from "../weeek/init-board.js";
export function registerInitBoard(server, context) {
    server.registerTool("weeek_init_board", {
        title: "Init a board for the AI-task workflow",
        description: "Idempotently ensure a board has the canonical workflow columns and the 'ИИ-отчёт' + 'ИИ-диалог' text fields, " +
            "plus the author-facing intakeFields (text/select with options) declared in the project's .weeek-mcp.json. " +
            "Matching is case-insensitive and only missing objects are created; a same-name field of another type is reported as a conflict and left untouched. " +
            "On a board without tasks custom fields are not created (status 'skipped', fieldsVisible:false): the Weeek API shows a board's fields only through its tasks, so it cannot tell which already exist. " +
            "Use dryRun:true to preview.",
        inputSchema: {
            boardId: z
                .number()
                .default(context.boardId)
                .describe(`Board ID. Defaults to ${context.boardId}.`),
            includeOptional: z
                .boolean()
                .default(false)
                .describe("Also ensure optional manual-workflow columns."),
            dryRun: z
                .boolean()
                .default(false)
                .describe("Preview missing objects without calling write APIs."),
        },
        annotations: {
            readOnlyHint: false,
            idempotentHint: true,
            destructiveHint: false,
            openWorldHint: true,
        },
    }, async ({ boardId, includeOptional, dryRun }) => {
        const report = await ensureBoard(context, { boardId, includeOptional, dryRun });
        const status = dryRun
            ? "Dry run — nothing was created."
            : report.fieldsVisible
                ? "Board is ready for the weeek_* AI-task workflow."
                : "Columns are ensured; custom fields are not.";
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        ...report,
                        note: report.fieldsVisible
                            ? status
                            : `${status} ${fieldsHiddenMessage(report.boardId)}`,
                    }, null, 2),
                },
            ],
        };
    });
}
