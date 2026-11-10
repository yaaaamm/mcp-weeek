import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";
export declare function listPendingTasks(context: ServerContext, boardId: number): Promise<{
    boardId: number;
    totalPending: number;
    columns: {
        role: "SOURCE_ERRORS" | "SOURCE_IMPROVEMENTS";
        name: string;
        boardColumnId: number;
        count: number;
        truncated: boolean;
        tasks: import("./task-list-format.js").CompactTask[];
    }[];
    nextSteps: {
        claim: string;
        read: string;
        finish: string;
    };
}>;
export declare function registerListPendingTasks(server: McpServer, context: ServerContext): void;
