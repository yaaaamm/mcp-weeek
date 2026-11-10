import { z } from "zod";
export function registerUpdateTask(server, context) {
    server.registerTool("weeek_update_task", {
        title: "Update Weeek task",
        description: "Update task title or priority. NOTE: Weeek public API v1 silently ignores description updates — use weeek_set_ai_report (ИИ-отчёт custom field) for textual notes instead. For column changes use weeek_move_task.",
        inputSchema: {
            taskId: z.number().describe("Task ID"),
            title: z.string().optional().describe("New title"),
            priority: z
                .number()
                .min(0)
                .max(3)
                .optional()
                .describe("Priority: 0=none, 1=low, 2=medium, 3=high"),
        },
        annotations: {
            readOnlyHint: false,
            idempotentHint: true,
            destructiveHint: false,
            openWorldHint: true,
        },
    }, async ({ taskId, title, priority }) => {
        const body = {};
        if (title !== undefined)
            body.title = title;
        if (priority !== undefined)
            body.priority = priority;
        const res = await context.weeek.put(`/tm/tasks/${taskId}`, body);
        return {
            content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
    });
}
