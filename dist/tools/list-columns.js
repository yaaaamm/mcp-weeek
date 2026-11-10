import { z } from "zod";
export function registerListColumns(server, context) {
    server.registerTool("weeek_list_columns", {
        title: "List Weeek board columns",
        description: "List all columns on a Weeek board.",
        inputSchema: {
            boardId: z
                .number()
                .default(context.boardId)
                .describe(`Board ID. Defaults to ${context.boardId} (this instance's board).`),
        },
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ boardId }) => {
        const res = await context.weeek.get("/tm/board-columns", { boardId });
        return {
            content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
    });
}
