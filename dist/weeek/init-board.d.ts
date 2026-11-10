import type { IntakeField } from "../config/schema.js";
import type { ServerContext } from "../server-context.js";
export type BoardItemOutcome = {
    name: string;
    status: "created" | "existing" | "skipped";
    id?: number | string;
};
export type IntakeFieldOutcome = {
    name: string;
    type: IntakeField["type"];
    status: "created" | "existing" | "conflict" | "skipped";
    id?: string;
    options?: BoardItemOutcome[];
};
export type BoardInitOptions = {
    boardId?: number;
    includeOptional?: boolean;
    dryRun?: boolean;
};
export type BoardInitReport = {
    boardId: number;
    dryRun: boolean;
    includeOptional: boolean;
    /** false when the board has no tasks: custom fields were then not touched. */
    fieldsVisible: boolean;
    createdCount: number;
    columns: BoardItemOutcome[];
    customFields: BoardItemOutcome[];
    customField: BoardItemOutcome;
    intakeFields: IntakeFieldOutcome[];
};
/**
 * The Weeek API has no endpoint that lists a board's custom fields; they are
 * visible only on its tasks. On a board without tasks there is no way to tell
 * which fields already exist, so init-board creates none there — otherwise
 * every rerun on that board would add another copy of each field.
 */
export declare function fieldsHiddenMessage(boardId: number): string;
export declare function ensureBoard(context: ServerContext, options?: BoardInitOptions): Promise<BoardInitReport>;
