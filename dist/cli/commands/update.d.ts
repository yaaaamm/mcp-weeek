import type { ClientName } from "../../clients/types.js";
import type { CliFlags } from "../args.js";
import { type SetupDependencies, type SetupResult } from "./setup.js";
export { SELF_INSTALL_ARGS, SELF_INSTALL_SOURCE } from "../self-update.js";
export type UpdateFlags = {
    clients?: readonly ClientName[];
    config?: string;
    serverName?: string;
    skills?: boolean;
    overwriteSkills?: boolean;
    dryRun?: boolean;
    self?: boolean;
};
export type UpdateDependencies = SetupDependencies & {
    /** Переустановка глобального пакета; отдельной зависимостью — ради тестов. */
    installSelf?: (source: string) => Promise<void>;
};
/**
 * `update` — это `setup --repair` без вопросов про доску: конфиг уже есть,
 * меняется только то, что приносит новая версия пакета. Нужен как отдельная
 * команда, потому что обновляться ходят из проекта, а не из репозитория
 * инструмента, и делают это часто.
 */
export declare function runUpdate(flags: UpdateFlags, dependencies: UpdateDependencies): Promise<SetupResult>;
export declare function runUpdateCommand(flags: CliFlags): Promise<number>;
