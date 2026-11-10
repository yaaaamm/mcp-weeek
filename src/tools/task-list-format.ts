export type CustomFieldOption = { id: string; name: string; color?: string };

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

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  return Array.isArray(value) && value.length === 0;
}

export function resolveTaskCustomFields(
  task: WeeekTask
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of task.customFields ?? []) {
    if (!field.name || isEmpty(field.value)) continue;
    let value: unknown = field.value;
    if (field.type === "select" && typeof value === "string" && field.options) {
      value = field.options.find((option) => option.id === value)?.name ?? value;
    } else if (
      field.type === "multiselect" &&
      Array.isArray(value) &&
      field.options
    ) {
      value = value.map(
        (id) => field.options!.find((option) => option.id === id)?.name ?? id
      );
    }
    result[field.name] = value;
  }
  return result;
}

function compactTask(task: WeeekTask): CompactTask {
  const compact: CompactTask = {
    id: task.id,
    title: task.title,
    boardColumnId: task.boardColumnId,
    priority: task.priority,
    fields: resolveTaskCustomFields(task),
  };
  // Задача может лежать сразу на нескольких досках. Тогда верхний boardColumnId
  // показывает колонку ЧУЖОЙ доски, а членство в нашей живёт в locations[] —
  // отдаём их наружу, иначе потребитель отфильтрует задачу мимо (weeek #3210/#3208).
  if ((task.locations?.length ?? 0) > 1) compact.locations = task.locations;
  return compact;
}

export function compactIncompleteTasks(tasks: WeeekTask[]): CompactTask[] {
  return tasks.filter((task) => !task.isCompleted).map(compactTask);
}

/** В отличие от `compactIncompleteTasks` ничего не отбрасывает — завершённые помечает флагом. */
export function compactAllTasks(tasks: WeeekTask[]): CompactTask[] {
  return tasks.map((task) => ({
    ...compactTask(task),
    isCompleted: Boolean(task.isCompleted),
  }));
}
