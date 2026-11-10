export type CustomFieldOption = {
    id: string;
    name: string;
    color?: string;
};
export type TaskCustomField = {
    id: string;
    name: string | null;
    type: string;
    value: unknown;
    options?: CustomFieldOption[];
};
export type TaskLocation = {
    projectId?: number;
    boardId?: number | null;
    boardColumnId?: number | null;
};
export type WeeekTask = {
    id: number;
    title: string;
    boardColumnId: number;
    priority: number | null;
    isCompleted?: boolean;
    customFields?: TaskCustomField[];
    locations?: TaskLocation[];
};
export type ListTasksResponse = {
    success: boolean;
    tasks?: WeeekTask[];
    hasMore?: boolean;
};
export type CompactTask = {
    id: number;
    title: string;
    boardColumnId: number;
    priority: number | null;
    fields: Record<string, unknown>;
    isCompleted?: boolean;
    /** Проставляется, только когда задача живёт больше чем на одной доске. */
    locations?: TaskLocation[];
};
export declare function resolveTaskCustomFields(task: WeeekTask): Record<string, unknown>;
export declare function compactIncompleteTasks(tasks: WeeekTask[]): CompactTask[];
/** В отличие от `compactIncompleteTasks` ничего не отбрасывает — завершённые помечает флагом. */
export declare function compactAllTasks(tasks: WeeekTask[]): CompactTask[];
