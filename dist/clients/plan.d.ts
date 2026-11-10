import type { ClientChange, ClientName } from "./types.js";
export type PlanClientChangesOptions = {
    clients: readonly ClientName[];
    projectRoot: string;
    configPath: string;
    executablePath: string;
    commandArgsPrefix?: readonly string[];
    serverName: string;
    homeDir: string;
    platform: NodeJS.Platform;
    appDataDir?: string;
    isTracked?: (filePath: string) => Promise<boolean>;
};
export declare function planClientChanges(options: PlanClientChangesOptions): Promise<ClientChange[]>;
