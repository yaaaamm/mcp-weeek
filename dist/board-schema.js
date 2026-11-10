import { ROLE_COLUMN_NAMES, AI_REPORT_FIELD_NAME } from "./constants.js";
import { McpWeeekError } from "./errors.js";
function dedupeFields(tasks) {
    const byId = new Map();
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
export function normalizeName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}
export function createBoardSchema(weeek) {
    const columnsCache = new Map();
    const fieldsCache = new Map();
    const taskCountCache = new Map();
    async function getColumns(boardId, refresh = false) {
        if (!refresh && columnsCache.has(boardId))
            return columnsCache.get(boardId);
        const response = (await weeek.get("/tm/board-columns", { boardId }));
        const columns = response.boardColumns ?? [];
        columnsCache.set(boardId, columns);
        return columns;
    }
    async function getCustomFields(boardId, refresh = false) {
        if (!refresh && fieldsCache.has(boardId))
            return fieldsCache.get(boardId);
        const response = (await weeek.get("/tm/tasks", { boardId }));
        const tasks = response.tasks ?? [];
        const fields = dedupeFields(tasks);
        fieldsCache.set(boardId, fields);
        taskCountCache.set(boardId, tasks.length);
        return fields;
    }
    async function boardHasTasks(boardId) {
        // Same response as getCustomFields, so a fresh field read costs no request.
        if (!taskCountCache.has(boardId))
            await getCustomFields(boardId);
        return (taskCountCache.get(boardId) ?? 0) > 0;
    }
    function invalidateBoard(boardId) {
        columnsCache.delete(boardId);
        fieldsCache.delete(boardId);
        taskCountCache.delete(boardId);
    }
    async function findColumnId(boardId, name) {
        const target = normalizeName(name);
        const column = (await getColumns(boardId)).find((candidate) => normalizeName(candidate.name) === target);
        return column?.id ?? null;
    }
    async function resolveRoleColumnId(boardId, role) {
        const name = ROLE_COLUMN_NAMES[role];
        const id = await findColumnId(boardId, name);
        if (id === null) {
            throw new McpWeeekError("BOARD_SCHEMA_INCOMPLETE", `Column "${name}" (role ${role}) not found on board ${boardId}. ` +
                "Run mcp-weeek init-board.");
        }
        return id;
    }
    async function findCustomField(boardId, name, sampleTaskId) {
        const target = normalizeName(name);
        const match = (fields) => fields.find((field) => field.name != null && normalizeName(field.name) === target) ?? null;
        const fromBoard = match(await getCustomFields(boardId));
        if (fromBoard !== null || sampleTaskId === undefined)
            return fromBoard;
        const response = (await weeek.get(`/tm/tasks/${sampleTaskId}`));
        return match(dedupeFields(response.task ? [response.task] : []));
    }
    async function findCustomFieldId(boardId, name, sampleTaskId) {
        return (await findCustomField(boardId, name, sampleTaskId))?.id ?? null;
    }
    async function resolveTextCustomFieldId(boardId, name, sampleTaskId) {
        const field = await findCustomField(boardId, name, sampleTaskId);
        if (field === null || field.type !== "text") {
            throw new McpWeeekError("BOARD_SCHEMA_INCOMPLETE", `Text custom field "${name}" was not found on board ${boardId}. ` +
                "Run mcp-weeek init-board.");
        }
        return field.id;
    }
    async function resolveAiReportFieldId(boardId, sampleTaskId) {
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
