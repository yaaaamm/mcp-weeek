import { type ServerContext } from "../server-context.js";
export type LoadRuntimeOptions = {
    configPath?: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    allowLegacyEnv?: boolean;
    fetch?: typeof globalThis.fetch;
};
export declare function loadServerContext(options?: LoadRuntimeOptions): Promise<ServerContext>;
export declare function serve(options?: LoadRuntimeOptions): Promise<void>;
