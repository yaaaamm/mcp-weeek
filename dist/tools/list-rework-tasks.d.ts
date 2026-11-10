import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";
import { type CompactTask } from "./task-list-format.js";
export type ReworkQueueResult = {
    boardId: number;
    role: "AI_REWORK";
    name: string;
    boardColumnId: number;
    totalRework: number;
    /** true = упёрлись в предохранитель пагинации, очередь показана НЕ целиком. */
    truncated: boolean;
    tasks: CompactTask[];
    nextSteps: {
        read: string;
        claim: string;
        finish: string;
    };
};
export declare function listReworkTasks(context: ServerContext, boardId: number): Promise<ReworkQueueResult>;
export declare function registerListReworkTasks(server: McpServer, context: ServerContext): void;
