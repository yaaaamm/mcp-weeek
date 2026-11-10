export type McpWeeekErrorCode = "CONFIG_NOT_FOUND" | "CONFIG_INVALID" | "TOKEN_NOT_FOUND" | "WEEEK_AUTH_FAILED" | "BOARD_NOT_FOUND" | "BOARD_SCHEMA_INCOMPLETE" | "CLIENT_CONFIG_CONFLICT" | "MCP_EXECUTABLE_NOT_FOUND" | "MCP_HANDSHAKE_FAILED";
export declare class McpWeeekError extends Error {
    readonly code: McpWeeekErrorCode;
    readonly cause?: unknown;
    constructor(code: McpWeeekErrorCode, message: string, options?: {
        cause?: unknown;
    });
}
export declare function asMcpWeeekError(error: unknown, code: McpWeeekErrorCode, message: string): McpWeeekError;
