import { z } from "zod";
import { normalizeName } from "../board-schema.js";
import { AI_DIALOG_FIELD_NAME, ROLE_COLUMN_NAMES, } from "../constants.js";
import { McpWeeekError } from "../errors.js";
export function appendAiQuestion(current, question, timestamp) {
    const entry = `[ИИ · ${timestamp.toISOString()}]\nВопрос: ${question.trim()}`;
    return current.trim() ? `${current.trimEnd()}\n\n${entry}` : entry;
}
export async function askQuestion(context, input, now = () => new Date()) {
    const question = input.question.trim();
    if (!question) {
        throw new McpWeeekError("CONFIG_INVALID", "Question must not be empty.");
    }
    const response = (await context.weeek.get(`/tm/tasks/${input.taskId}`));
    if (!response.task) {
        throw new McpWeeekError("BOARD_SCHEMA_INCOMPLETE", `Task ${input.taskId} did not return dialog field metadata.`);
    }
    const [dialogFieldId, discussColumnId] = await Promise.all([
        context.boardSchema.resolveTextCustomFieldId(input.boardId, AI_DIALOG_FIELD_NAME, input.taskId),
        context.boardSchema.resolveRoleColumnId(input.boardId, "DISCUSS"),
    ]);
    const dialogField = response.task.customFields?.find((field) => field.id === dialogFieldId ||
        (field.name != null &&
            normalizeName(field.name) === normalizeName(AI_DIALOG_FIELD_NAME)));
    const currentValue = dialogField?.value;
    if (currentValue !== undefined &&
        currentValue !== null &&
        typeof currentValue !== "string") {
        throw new McpWeeekError("BOARD_SCHEMA_INCOMPLETE", `Text custom field "${AI_DIALOG_FIELD_NAME}" has a non-text value. ` +
            "Run mcp-weeek init-board.");
    }
    const timestamp = now();
    const appendedEntry = `[ИИ · ${timestamp.toISOString()}]\nВопрос: ${question}`;
    const dialog = appendAiQuestion(currentValue ?? "", question, timestamp);
    await context.weeek.put(`/tm/tasks/${input.taskId}`, {
        customFields: { [dialogFieldId]: dialog },
        boardColumnId: discussColumnId,
    });
    return {
        taskId: input.taskId,
        destinationRole: "DISCUSS",
        destinationName: ROLE_COLUMN_NAMES.DISCUSS,
        appendedEntry,
    };
}
export function registerAskQuestion(server, context) {
    server.registerTool("weeek_ask_question", {
        title: "Ask a human a question about a Weeek task",
        description: "Use when requirements or human review feedback are unclear. Appends a timestamped question to the required 'ИИ-диалог' text field without erasing its history and moves the task to 'Обсудить' in one update. May be used for any task. Wait until a human answers and returns the task to AI_REWORK ('Доработать ИИ').",
        inputSchema: {
            taskId: z.number().describe("Task ID that needs clarification"),
            question: z
                .string()
                .trim()
                .min(1, "Question must not be empty")
                .describe("Concrete plain-text question for the human reviewer"),
            boardId: z
                .number()
                .default(context.boardId)
                .describe(`Board ID. Defaults to ${context.boardId}.`),
        },
        annotations: {
            readOnlyHint: false,
            idempotentHint: false,
            destructiveHint: false,
            openWorldHint: true,
        },
    }, async ({ taskId, question, boardId }) => ({
        content: [
            {
                type: "text",
                text: JSON.stringify(await askQuestion(context, { taskId, question, boardId }), null, 2),
            },
        ],
    }));
}
