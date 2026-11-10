import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
export const SELF_INSTALL_SOURCE = "git+https://github.com/yaaaamm/mcp-weeek.git";
/**
 * Обычная установка, без флагов и обходных путей. Это возможно только потому,
 * что в package.json нет ни одного скрипта из списка, на который смотрит
 * pacote (postinstall, build, preinstall, install, prepack, prepare): их
 * наличие включает подготовку git-пакета — вложенный `npm install` внутри
 * клона, который наследует префикс родителя и валит повторную установку с
 * ENOTEMPTY, а сам пакет подсовывает симлинком на временный клон.
 * Поэтому сборка называется `compile`, а dist коммитится.
 */
export const SELF_INSTALL_ARGS = ["install", "--global", SELF_INSTALL_SOURCE];
/** Метка, по которой перезапущенный процесс понимает, что обновление уже было. */
export const SELF_CHECK_ENV = "MCP_WEEEK_SELF_CHECKED";
export async function installSelf() {
    await execFileAsync("npm", SELF_INSTALL_ARGS, { maxBuffer: 10 * 1024 * 1024 });
}
/**
 * Перезапускает ту же команду уже установленной новой сборкой. Метка в
 * окружении гасит повторное обновление, иначе получился бы цикл.
 */
export function reexecSelf() {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [process.argv[1], ...process.argv.slice(2)], {
            stdio: "inherit",
            env: { ...process.env, [SELF_CHECK_ENV]: "1" },
        });
        child.on("error", () => resolve(1));
        child.on("close", (code) => resolve(code ?? 1));
    });
}
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
export async function refreshSelf(dependencies) {
    if (dependencies.env[SELF_CHECK_ENV])
        return null;
    dependencies.output("Fetching the latest mcp-weeek ...");
    try {
        await (dependencies.install ?? installSelf)();
    }
    catch (error) {
        dependencies.output(`Self-update failed, continuing with the installed version: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
    dependencies.output("Up to date. Rerunning the command ...");
    return dependencies.reexec ? dependencies.reexec() : null;
}
/** Стандартная обвязка для CLI-команд. */
export function selfRefreshDependencies() {
    return {
        output: (line) => process.stdout.write(`${line}\n`),
        env: process.env,
        reexec: reexecSelf,
    };
}
