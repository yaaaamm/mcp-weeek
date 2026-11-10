export type ClientName = "codex" | "claude-code" | "antigravity" | "claude-desktop";
export type ClientChangeStatus = "added" | "updated" | "unchanged";
export type ClientChange = {
    client: ClientName;
    path: string;
    before: string;
    after: string;
    status: ClientChangeStatus;
    backup: boolean;
    tracked: boolean;
};
export type StdioEntry = {
    type?: "stdio";
    command: string;
    args: string[];
};
