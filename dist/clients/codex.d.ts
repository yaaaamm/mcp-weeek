import type { ClientChangeStatus } from "./types.js";
export declare function renderCodexConfig(text: string, serverName: string, executablePath: string, args: string[]): {
    after: string;
    status: ClientChangeStatus;
};
