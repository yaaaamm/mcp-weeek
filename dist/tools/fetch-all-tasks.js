/**
 * GET /tm/tasks отдаёт страницу и флаг `hasMore` (docs: developers.weeek.net/api/task).
 * Дефолт страницы — 20 задач. Инструменты, читавшие ответ одним запросом, молча
 * теряли всё, что не влезло: 19.08.2026 из-за этого `/weeek-release` отчитался о
 * разобранной колонке, в которой осталось 8 задач из 26.
 */
const PAGE_SIZE = 100;
/** Предохранитель от бесконечного цикла, если API однажды перестанет гасить hasMore. */
const MAX_PAGES = 50;
/** Читает /tm/tasks постранично, пока API не скажет `hasMore: false`. */
export async function fetchAllTasks(weeek, params) {
    const tasks = [];
    let offset = 0;
    let pagesFetched = 0;
    for (;;) {
        const page = (await weeek.get("/tm/tasks", {
            ...params,
            perPage: PAGE_SIZE,
            offset,
        }));
        pagesFetched += 1;
        const batch = page.tasks ?? [];
        tasks.push(...batch);
        // Пустая страница при hasMore:true означала бы вечный цикл — выходим.
        if (!page.hasMore || batch.length === 0) {
            return { tasks, pagesFetched, truncated: false };
        }
        if (pagesFetched >= MAX_PAGES) {
            return { tasks, pagesFetched, truncated: true };
        }
        // Сдвигаемся на фактически полученное, а не на PAGE_SIZE: если API отдал
        // меньше запрошенного, шаг по PAGE_SIZE перепрыгнул бы часть задач.
        offset += batch.length;
    }
}
