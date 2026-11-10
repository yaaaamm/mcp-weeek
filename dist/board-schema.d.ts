import { type ColumnRole } from "./constants.js";
import type { WeeekClient } from "./weeek-client.js";
export type BoardColumn = {
    id: number;
    name: string;
    boardId: number;
};
export type CustomFieldOption = {
    id: string;
    name: string;
};
export type CustomField = {
    id: string;
    name: string | null;
    type?: string;
    options?: CustomFieldOption[];
};
export interface BoardSchema {
    getColumns(boardId: number, refresh?: boolean): Promise<BoardColumn[]>;
    getCustomFields(boardId: number, refresh?: boolean): Promise<CustomField[]>;
    /**
     * Whether the board has at least one task. The Weeek API has no endpoint that
     * lists a board's custom fields; they are only visible on its tasks. On a
     * board without tasks an empty field list therefore means "unknown", not
     * "none", and creating fields there could duplicate existing ones.
     */
    boardHasTasks(boardId: number): Promise<boolean>;
    invalidateBoard(boardId: number): void;
    findColumnId(boardId: number, name: string): Promise<number | null>;
    resolveRoleColumnId(boardId: number, role: ColumnRole): Promise<number>;
    findCustomFieldId(boardId: number, name: string, sampleTaskId?: number): Promise<string | null>;
    resolveTextCustomFieldId(boardId: number, name: string, sampleTaskId?: number): Promise<string>;
    resolveAiReportFieldId(boardId: number, sampleTaskId?: number): Promise<string>;
}
export declare function normalizeName(name: string): string;
export declare function createBoardSchema(weeek: WeeekClient): BoardSchema;
