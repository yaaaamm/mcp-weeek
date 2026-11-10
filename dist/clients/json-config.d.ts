import type { ClientChangeStatus, StdioEntry } from "./types.js";
export declare function renderJsonMcpConfig(text: string, serverName: string, entry: StdioEntry): {
    after: string;
    status: ClientChangeStatus;
};
