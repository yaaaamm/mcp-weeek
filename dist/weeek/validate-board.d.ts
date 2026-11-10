import type { BoardBinding } from "../config/board-url.js";
export declare function validateBoardAccess(input: {
    binding: BoardBinding;
    token: string;
    fetch?: typeof globalThis.fetch;
}): Promise<void>;
