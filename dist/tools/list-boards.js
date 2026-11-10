import { z } from "zod";
export function registerListBoards(server, context) {
    server.registerTool("weeek_list_boards", {
        title: "List Weeek boards",
        description: "List all boards in a Weeek project.",
        inputSchema: {
            projectId: z
                .number()
                .default(context.projectId)
                .describe(`Project ID. Defaults to ${context.projectId}.`),
        },
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ projectId }) => {
        const res = await context.weeek.get("/tm/boards", { projectId });
        return {
            content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
    });
}
