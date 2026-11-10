export class McpWeeekError extends Error {
    code;
    cause;
    constructor(code, message, options) {
        super(message);
        this.name = "McpWeeekError";
        this.code = code;
        this.cause = options?.cause;
    }
}
export function asMcpWeeekError(error, code, message) {
    if (error instanceof McpWeeekError)
        return error;
    return new McpWeeekError(code, message, { cause: error });
}
