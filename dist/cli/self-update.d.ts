export declare const SELF_INSTALL_SOURCE = "git+https://github.com/yaaaamm/mcp-weeek.git";
/**
 * Обычная установка, без флагов и обходных путей. Это возможно только потому,
 * что в package.json нет ни одного скрипта из списка, на который смотрит
 * pacote (postinstall, build, preinstall, install, prepack, prepare): их
 * наличие включает подготовку git-пакета — вложенный `npm install` внутри
 * клона, который наследует префикс родителя и валит повторную установку с
 * ENOTEMPTY, а сам пакет подсовывает симлинком на временный клон.
 * Поэтому сборка называется `compile`, а dist коммитится.
 */
export declare const SELF_INSTALL_ARGS: string[];
/** Метка, по которой перезапущенный процесс понимает, что обновление уже было. */
export declare const SELF_CHECK_ENV = "MCP_WEEEK_SELF_CHECKED";
export declare function installSelf(): Promise<void>;
/**
 * Перезапускает ту же команду уже установленной новой сборкой. Метка в
 * окружении гасит повторное обновление, иначе получился бы цикл.
 */
export declare function reexecSelf(): Promise<number>;
export type SelfRefreshDependencies = {
    output: (line: string) => void;
    env: NodeJS.ProcessEnv;
    install?: () => Promise<void>;
    /** Перезапуск уже обновлённого CLI с теми же аргументами. */
    reexec?: () => Promise<number>;
};
/**
 * Перед работой в проекте подтягивает свежую сборку и перезапускает команду
 * ею же. Возвращает код выхода, если процесс должен завершиться, или null —
 * если продолжаем текущим.
 *
 * Почему просто переустановка, без сравнения версий: пакет не публикуется в
 * registry, а `dist` коммитится — значит записанный в сборке коммит всегда
 * отстаёт на один от коммита, который её привозит, и любое сравнение
 * рапортовало бы «устарел» вечно. Переустановка же всегда даёт верный
 * результат; цена — несколько секунд сети.
 *
 * Обновление никогда не должно мешать работе: нет сети или npm упал —
 * печатаем причину и продолжаем на установленной версии.
 */
export declare function refreshSelf(dependencies: SelfRefreshDependencies): Promise<number | null>;
/** Стандартная обвязка для CLI-команд. */
export declare function selfRefreshDependencies(): SelfRefreshDependencies;
