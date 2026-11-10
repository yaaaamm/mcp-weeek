import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";
export type AskQuestionInput = {
    taskId: number;
    question: string;
    boardId: number;
};
export type AskQuestionResult = {
    taskId: number;
    destinationRole: "DISCUSS";
    destinationName: string;
    appendedEntry: string;
};
export declare function appendAiQuestion(current: string, question: string, timestamp: Date): string;
export declare function askQuestion(context: ServerContext, input: AskQuestionInput, now?: () => Date): Promise<AskQuestionResult>;
export declare function registerAskQuestion(server: McpServer, context: ServerContext): void;
