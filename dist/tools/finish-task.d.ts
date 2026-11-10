import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";
export type FinishTaskInput = {
    taskId: number;
    report: string;
    boardId: number;
};
export type FinishTaskResult = {
    taskId: number;
    destinationRole: "AWAITING_RELEASE";
    destinationName: string;
    boardColumnId: number;
    reportUpdated: true;
};
export declare function finishTask(context: ServerContext, input: FinishTaskInput): Promise<FinishTaskResult>;
export declare function registerFinishTask(server: McpServer, context: ServerContext): void;
