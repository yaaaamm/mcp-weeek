import type { ClientChangeStatus, ClientName } from "../clients/types.js";
import { type SkillName } from "./catalog.js";
import { type SkillOwnership } from "./marker.js";
export type SkillChange = {
    client: ClientName;
    skill: SkillName;
    path: string;
    before: string;
    after: string;
    status: ClientChangeStatus;
    /** Кто владеет файлом на диске — решает, можно ли переписать его молча. */
    ownership: SkillOwnership;
    /** Версия пакета, положившего файл; null у скопированных руками. */
    installedVersion: string | null;
};
export type PlanSkillChangesOptions = {
    clients: readonly ClientName[];
    projectRoot: string;
};
export declare function planSkillChanges(options: PlanSkillChangesOptions): Promise<SkillChange[]>;
/**
 * Файлы, которые нельзя трогать без явного разрешения: их правили руками или
 * положили мимо инструмента. Всё остальное обновляется молча.
 */
export declare function needsConfirmation(change: SkillChange): boolean;
