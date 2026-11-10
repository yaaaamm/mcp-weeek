function isEmpty(value) {
    if (value === null || value === undefined || value === "")
        return true;
    return Array.isArray(value) && value.length === 0;
}
export function resolveTaskCustomFields(task) {
    const result = {};
    for (const field of task.customFields ?? []) {
        if (!field.name || isEmpty(field.value))
            continue;
        let value = field.value;
        if (field.type === "select" && typeof value === "string" && field.options) {
            value = field.options.find((option) => option.id === value)?.name ?? value;
        }
        else if (field.type === "multiselect" &&
            Array.isArray(value) &&
            field.options) {
            value = value.map((id) => field.options.find((option) => option.id === id)?.name ?? id);
        }
        result[field.name] = value;
    }
    return result;
}
function compactTask(task) {
    const compact = {
        id: task.id,
        title: task.title,
        boardColumnId: task.boardColumnId,
        priority: task.priority,
        fields: resolveTaskCustomFields(task),
    };
    // Задача может лежать сразу на нескольких досках. Тогда верхний boardColumnId
    // показывает колонку ЧУЖОЙ доски, а членство в нашей живёт в locations[] —
    // отдаём их наружу, иначе потребитель отфильтрует задачу мимо (weeek #3210/#3208).
    if ((task.locations?.length ?? 0) > 1)
        compact.locations = task.locations;
    return compact;
}
export function compactIncompleteTasks(tasks) {
    return tasks.filter((task) => !task.isCompleted).map(compactTask);
}
/** В отличие от `compactIncompleteTasks` ничего не отбрасывает — завершённые помечает флагом. */
export function compactAllTasks(tasks) {
    return tasks.map((task) => ({
        ...compactTask(task),
        isCompleted: Boolean(task.isCompleted),
    }));
}
