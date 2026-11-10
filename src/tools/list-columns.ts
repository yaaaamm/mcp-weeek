import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";

export function registerListColumns(server: McpServer, context: ServerContext) {
  server.registerTool(
    "weeek_list_columns",
    {
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
    },
    async ({ boardId }) => {
      const res = await context.weeek.get("/tm/board-columns", { boardId });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(res, null, 2) }],
      };
    }
  );
}
