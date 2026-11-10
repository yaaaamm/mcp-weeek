import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";

export function registerCompleteTask(server: McpServer, context: ServerContext) {
  server.registerTool(
    "weeek_complete_task",
    {
      title: "Mark Weeek task completed",
      description:
        "Legacy operation that marks a Weeek task completed (sets isCompleted=true). Do not use it to finish the AI feedback workflow: call weeek_finish_task so ИИ-отчёт and the AWAITING_RELEASE transition stay coupled in one update.",
      inputSchema: { taskId: z.number().describe("Task ID to complete") },
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    async ({ taskId }) => {
      const res = await context.weeek.post(`/tm/tasks/${taskId}/complete`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(res, null, 2) }],
      };
    }
  );
}
