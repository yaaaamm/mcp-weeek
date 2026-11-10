import type { Query, WeeekClient } from "../weeek-client.js";
import type { WeeekTask } from "./task-list-format.js";
export type FetchAllTasksResult = {
    tasks: WeeekTask[];
    pagesFetched: number;
    /** true = упёрлись в MAX_PAGES, список НЕполный. Обязан долетать до потребителя. */
    truncated: boolean;
};
/** Читает /tm/tasks постранично, пока API не скажет `hasMore: false`. */
export declare function fetchAllTasks(weeek: WeeekClient, params: Query): Promise<FetchAllTasksResult>;
