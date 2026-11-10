import { type BoardBinding } from "./board-url.js";
import { type ProjectConfig } from "./schema.js";
export type LoadedProjectConfig = {
    path: string;
    rootDir: string;
    config: ProjectConfig;
    binding: BoardBinding;
};
export declare function loadProjectConfig(configPath: string): Promise<LoadedProjectConfig>;
