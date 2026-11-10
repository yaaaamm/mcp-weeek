import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { COLUMN_ROLES, ROLE_COLUMN_NAMES } from "../constants.js";
import type { ServerContext } from "../server-context.js";

export function registerMoveTask(server: McpServer, context: ServerContext) {
  server.registerTool(
    "weeek_move_task",
    {
      title: "Move Weeek task to column",
      description:
        "Move a task to a different board column. Prefer the board-agnostic `role` param: claim via role 'AI_IN_PROGRESS' ('ИИ в работе') right after weeek_get_task; finalize via role 'AWAITING_RELEASE' ('Ожидает релиза') after the work + ИИ-отчёт. Role 'AI_DONE' ('ВЫПОЛНЕНО ИИ') is reserved for /weeek-release (run manually after git push) — do NOT move there from the AI-task workflow. Pass an explicit boardColumnId only for columns without a role.",
      inputSchema: {
        taskId: z.number().describe("Task ID to move"),
        role: z
          .enum(COLUMN_ROLES)
          .optional()
          .describe(
            "Workflow role of the target column (resolved by name on the board). One of: " +
              Object.entries(ROLE_COLUMN_NAMES)
                .map(([k, v]) => `${k} ('${v}')`)
                .join(", ")
          ),
        boardColumnId: z
          .number()
          .optional()
          .describe("Explicit target column ID. Use only when `role` doesn't cover the column."),
        boardId: z
          .number()
          .default(context.boardId)
          .describe(`Board ID for role resolution. Defaults to ${context.boardId}.`),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ taskId, role, boardColumnId, boardId }) => {
      const targetColumnId =
        boardColumnId ??
        (role ? await context.boardSchema.resolveRoleColumnId(boardId, role) : undefined);
      if (targetColumnId === undefined) {
        throw new Error("Provide either `role` or `boardColumnId`.");
      }
      const res = await context.weeek.put(`/tm/tasks/${taskId}`, {
        boardColumnId: targetColumnId,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(res, null, 2) }],
      };
    }
  );
}
