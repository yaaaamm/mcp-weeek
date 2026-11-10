import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";

export function registerListBoards(server: McpServer, context: ServerContext) {
  server.registerTool(
    "weeek_list_boards",
    {
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
    },
    async ({ projectId }) => {
      const res = await context.weeek.get("/tm/boards", { projectId });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(res, null, 2) }],
      };
    }
  );
}
