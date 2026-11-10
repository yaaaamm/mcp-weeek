import { type BoardSchema } from "./board-schema.js";
import type { LoadedProjectConfig } from "./config/load.js";
import type { IntakeField } from "./config/schema.js";
import { type WeeekClient } from "./weeek-client.js";
export type ServerContext = {
    configPath: string;
    projectRoot: string;
    workspaceId: number;
    projectId: number;
    boardId: number;
    intakeFields: IntakeField[];
    weeek: WeeekClient;
    boardSchema: BoardSchema;
};
export declare function createServerContext(loaded: LoadedProjectConfig, token: string, fetchImpl?: typeof globalThis.fetch): ServerContext;
