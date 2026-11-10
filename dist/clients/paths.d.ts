import type { ClientName } from "./types.js";
export type ClientPathOptions = {
    projectRoot: string;
    homeDir: string;
    platform: NodeJS.Platform;
    appDataDir?: string;
};
export declare function clientConfigPath(client: ClientName, options: ClientPathOptions): string;
