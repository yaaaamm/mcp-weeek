import { ROLE_COLUMN_NAMES, AI_REPORT_FIELD_NAME, type ColumnRole } from "./constants.js";
import { McpWeeekError } from "./errors.js";
import type { WeeekClient } from "./weeek-client.js";

export type BoardColumn = { id: number; name: string; boardId: number };
export type CustomFieldOption = { id: string; name: string };
export type CustomField = {
  id: string;
  name: string | null;
  type?: string;
  options?: CustomFieldOption[];
};

type ColumnsResponse = { success: boolean; boardColumns?: BoardColumn[] };
type TaskWithFields = { id?: number; customFields?: CustomField[] };
type TasksResponse = { success: boolean; tasks?: TaskWithFields[] };
type OneTaskResponse = { success?: boolean; task?: TaskWithFields };

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
  findCustomFieldId(
    boardId: number,
    name: string,
    sampleTaskId?: number
  ): Promise<string | null>;
  resolveTextCustomFieldId(
    boardId: number,
    name: string,
    sampleTaskId?: number
  ): Promise<string>;
  resolveAiReportFieldId(boardId: number, sampleTaskId?: number): Promise<string>;
}

function dedupeFields(tasks: TaskWithFields[]): CustomField[] {
  const byId = new Map<string, CustomField>();
  for (const task of tasks) {
    for (const field of task.customFields ?? []) {
      if (field?.id && !byId.has(field.id)) {
        byId.set(field.id, {
          id: field.id,
          name: field.name ?? null,
          type: field.type,
          options: field.options,
        });
      }
    }
  }
  return [...byId.values()];
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function createBoardSchema(weeek: WeeekClient): BoardSchema {
  const columnsCache = new Map<number, BoardColumn[]>();
  const fieldsCache = new Map<number, CustomField[]>();
  const taskCountCache = new Map<number, number>();

  async function getColumns(boardId: number, refresh = false): Promise<BoardColumn[]> {
    if (!refresh && columnsCache.has(boardId)) return columnsCache.get(boardId)!;
    const response = (await weeek.get("/tm/board-columns", { boardId })) as ColumnsResponse;
    const columns = response.boardColumns ?? [];
    columnsCache.set(boardId, columns);
    return columns;
  }

  async function getCustomFields(
    boardId: number,
    refresh = false
  ): Promise<CustomField[]> {
    if (!refresh && fieldsCache.has(boardId)) return fieldsCache.get(boardId)!;
    const response = (await weeek.get("/tm/tasks", { boardId })) as TasksResponse;
    const tasks = response.tasks ?? [];
    const fields = dedupeFields(tasks);
    fieldsCache.set(boardId, fields);
    taskCountCache.set(boardId, tasks.length);
    return fields;
  }

  async function boardHasTasks(boardId: number): Promise<boolean> {
    // Same response as getCustomFields, so a fresh field read costs no request.
    if (!taskCountCache.has(boardId)) await getCustomFields(boardId);
    return (taskCountCache.get(boardId) ?? 0) > 0;
  }

  function invalidateBoard(boardId: number): void {
    columnsCache.delete(boardId);
    fieldsCache.delete(boardId);
    taskCountCache.delete(boardId);
  }

  async function findColumnId(boardId: number, name: string): Promise<number | null> {
    const target = normalizeName(name);
    const column = (await getColumns(boardId)).find(
      (candidate) => normalizeName(candidate.name) === target
    );
    return column?.id ?? null;
  }

  async function resolveRoleColumnId(boardId: number, role: ColumnRole): Promise<number> {
    const name = ROLE_COLUMN_NAMES[role];
    const id = await findColumnId(boardId, name);
    if (id === null) {
      throw new McpWeeekError(
        "BOARD_SCHEMA_INCOMPLETE",
        `Column "${name}" (role ${role}) not found on board ${boardId}. ` +
          "Run mcp-weeek init-board."
      );
    }
    return id;
  }

  async function findCustomField(
    boardId: number,
    name: string,
    sampleTaskId?: number
  ): Promise<CustomField | null> {
    const target = normalizeName(name);
    const match = (fields: CustomField[]) =>
      fields.find(
        (field) => field.name != null && normalizeName(field.name) === target
      ) ?? null;

    const fromBoard = match(await getCustomFields(boardId));
    if (fromBoard !== null || sampleTaskId === undefined) return fromBoard;
    const response = (await weeek.get(`/tm/tasks/${sampleTaskId}`)) as OneTaskResponse;
    return match(dedupeFields(response.task ? [response.task] : []));
  }

  async function findCustomFieldId(
    boardId: number,
    name: string,
    sampleTaskId?: number
  ): Promise<string | null> {
    return (await findCustomField(boardId, name, sampleTaskId))?.id ?? null;
  }

  async function resolveTextCustomFieldId(
    boardId: number,
    name: string,
    sampleTaskId?: number
  ): Promise<string> {
    const field = await findCustomField(boardId, name, sampleTaskId);
    if (field === null || field.type !== "text") {
      throw new McpWeeekError(
        "BOARD_SCHEMA_INCOMPLETE",
        `Text custom field "${name}" was not found on board ${boardId}. ` +
          "Run mcp-weeek init-board."
      );
    }
    return field.id;
  }

  async function resolveAiReportFieldId(
    boardId: number,
    sampleTaskId?: number
  ): Promise<string> {
    return resolveTextCustomFieldId(boardId, AI_REPORT_FIELD_NAME, sampleTaskId);
  }

  return {
    getColumns,
    getCustomFields,
    boardHasTasks,
    invalidateBoard,
    findColumnId,
    resolveRoleColumnId,
    findCustomFieldId,
    resolveTextCustomFieldId,
    resolveAiReportFieldId,
  };
}
