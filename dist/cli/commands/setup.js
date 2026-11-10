import { execFile } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { parseBoardUrl } from "../../config/board-url.js";
import { loadProjectConfig } from "../../config/load.js";
import { findProjectRoot } from "../../config/project-root.js";
import { resolveToken } from "../../config/token-source.js";
import { planClientChanges } from "../../clients/plan.js";
import { McpWeeekError } from "../../errors.js";
import { applyClientChanges, writeAtomicText } from "../../files/atomic-write.js";
import { needsConfirmation, planSkillChanges } from "../../skills/plan.js";
import { validateBoardAccess } from "../../weeek/validate-board.js";
import { createPrompt } from "../prompt.js";
import { refreshSelf, selfRefreshDependencies } from "../self-update.js";
import { runDoctor } from "./doctor.js";
const execFileAsync = promisify(execFile);
const DEFAULT_CLIENTS = ["codex", "claude-code", "antigravity"];
async function readOptional(filePath) {
    try {
        return await readFile(filePath, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT")
            return "";
        throw error;
    }
}
async function defaultValidateBoard(input) {
    await validateBoardAccess(input);
}
async function defaultIsTracked(projectRoot, filePath) {
    const relative = path.relative(projectRoot, filePath);
    if (relative.startsWith(".."))
        return false;
    try {
        await execFileAsync("git", ["ls-files", "--error-unmatch", relative], {
            cwd: projectRoot,
        });
        return true;
    }
    catch {
        return false;
    }
}
function createLoaded(configPath, projectRoot, config, binding) {
    return { path: configPath, rootDir: projectRoot, config, binding };
}
function canonicalText(config) {
    return JSON.stringify(config, null, 2) + "\n";
}
export async function runSetup(flags, dependencies) {
    const projectRoot = await findProjectRoot(dependencies.cwd);
    const configPath = path.resolve(projectRoot, flags.config ?? ".weeek-mcp.json");
    const beforeCanonical = await readOptional(configPath);
    let loaded;
    if (flags.repair) {
        loaded = await loadProjectConfig(configPath);
    }
    else {
        const boardUrl = flags.boardUrl ?? (await dependencies.prompt.ask("Weeek board URL"));
        const binding = parseBoardUrl(boardUrl);
        const variable = flags.tokenVariable ?? "WEEEK_API_TOKEN";
        let config;
        if (flags.envFile) {
            config = {
                version: 1,
                boardUrl: binding.boardUrl,
                auth: { source: "env-file", file: flags.envFile, variable },
            };
        }
        else if (dependencies.env[variable]) {
            config = {
                version: 1,
                boardUrl: binding.boardUrl,
                auth: { source: "env", variable },
            };
        }
        else {
            const envFile = await dependencies.prompt.ask("Path to env file", ".env");
            config = {
                version: 1,
                boardUrl: binding.boardUrl,
                auth: { source: "env-file", file: envFile, variable },
            };
        }
        loaded = createLoaded(configPath, projectRoot, config, binding);
    }
    const token = await resolveToken(loaded, dependencies.env);
    await (dependencies.validateBoard ?? defaultValidateBoard)({
        binding: loaded.binding,
        token,
    });
    const clients = flags.clients ?? DEFAULT_CLIENTS;
    const changes = await planClientChanges({
        clients,
        projectRoot,
        configPath,
        executablePath: dependencies.executablePath,
        commandArgsPrefix: dependencies.commandArgsPrefix,
        serverName: flags.serverName ?? "weeek",
        homeDir: dependencies.homeDir,
        platform: dependencies.platform,
        appDataDir: dependencies.appDataDir,
        isTracked: dependencies.isTracked
            ? dependencies.isTracked
            : (filePath) => defaultIsTracked(projectRoot, filePath),
    });
    const skillChanges = flags.skills === false
        ? []
        : await planSkillChanges({ clients, projectRoot });
    const afterCanonical = canonicalText(loaded.config);
    const canonicalStatus = beforeCanonical === ""
        ? "added"
        : beforeCanonical === afterCanonical
            ? "unchanged"
            : "updated";
    dependencies.output(`Project config: ${canonicalStatus} ${configPath}`);
    for (const change of changes) {
        dependencies.output(`${change.client}: ${change.status} ${change.path}`);
        if (change.tracked) {
            dependencies.output(`Warning: tracked client config contains a machine-local executable path: ${change.path}`);
        }
    }
    const guardedSkills = skillChanges.filter(needsConfirmation);
    const autoSkills = skillChanges.filter((change) => change.status !== "unchanged" && !needsConfirmation(change));
    for (const change of autoSkills) {
        dependencies.output(`${change.client} skill ${change.skill}: ${change.status} ${change.path}`);
    }
    for (const change of guardedSkills) {
        const reason = change.ownership === "foreign"
            ? "not installed by mcp-weeek"
            : `edited locally since ${change.installedVersion ?? "install"}`;
        dependencies.output(`${change.client} skill ${change.skill}: needs confirmation (${reason}) ${change.path}`);
    }
    const unchangedSkills = skillChanges.filter((change) => change.status === "unchanged");
    if (unchangedSkills.length) {
        dependencies.output(`skills: ${unchangedSkills.length} already current`);
    }
    if (flags.dryRun) {
        return {
            projectRoot,
            configPath,
            canonicalStatus,
            changes,
            skillChanges,
            skippedSkills: guardedSkills,
            dryRun: true,
        };
    }
    if (!flags.yes && !(await dependencies.prompt.confirm("Apply these changes?"))) {
        return {
            projectRoot,
            configPath,
            canonicalStatus,
            changes,
            skillChanges,
            skippedSkills: guardedSkills,
            dryRun: true,
        };
    }
    // Правленые и чужие файлы не переписываются заодно с остальными: общий «да»
    // относился к плану, а не к потере ручных изменений.
    let overwriteGuarded = flags.overwriteSkills === true;
    if (guardedSkills.length && !overwriteGuarded && !flags.yes) {
        overwriteGuarded = await dependencies.prompt.confirm(`Overwrite ${guardedSkills.length} locally edited or unmanaged skill file(s)?`);
    }
    const skippedSkills = overwriteGuarded ? [] : guardedSkills;
    for (const change of skippedSkills) {
        dependencies.output(`Warning: kept local ${change.skill} for ${change.client}; rerun with --overwrite-skills to replace it: ${change.path}`);
    }
    const skillsToApply = overwriteGuarded ? skillChanges : autoSkills;
    try {
        if (canonicalStatus !== "unchanged")
            await writeAtomicText(configPath, afterCanonical);
        await applyClientChanges([...changes, ...skillsToApply]);
    }
    catch (error) {
        if (canonicalStatus !== "unchanged") {
            if (beforeCanonical === "")
                await unlink(configPath).catch(() => undefined);
            else
                await writeAtomicText(configPath, beforeCanonical).catch(() => undefined);
        }
        throw error;
    }
    await dependencies.afterSetupDoctor?.();
    return {
        projectRoot,
        configPath,
        canonicalStatus,
        changes,
        skillChanges,
        skippedSkills,
        dryRun: false,
    };
}
function parseClients(value) {
    if (typeof value !== "string")
        return undefined;
    const clients = value.split(",").map((item) => item.trim());
    const allowed = new Set([
        "codex",
        "claude-code",
        "antigravity",
        "claude-desktop",
    ]);
    for (const client of clients) {
        if (!allowed.has(client)) {
            throw new McpWeeekError("CONFIG_INVALID", `Unsupported MCP client: ${client}`);
        }
    }
    return clients;
}
export async function runSetupCommand(flags) {
    // Первичная настройка проекта — самый частый момент, когда установленная
    // копия инструмента оказывается старой; проверяем до записи любых файлов.
    if (flags.noSelfUpdate !== true) {
        const exitCode = await refreshSelf(selfRefreshDependencies());
        if (exitCode !== null)
            return exitCode;
    }
    const prompt = createPrompt();
    try {
        const clients = parseClients(flags.clients);
        const executablePath = process.execPath;
        const commandArgsPrefix = [path.resolve(process.argv[1])];
        await runSetup({
            boardUrl: typeof flags.boardUrl === "string" ? flags.boardUrl : undefined,
            envFile: typeof flags.envFile === "string" ? flags.envFile : undefined,
            tokenVariable: typeof flags.tokenVariable === "string" ? flags.tokenVariable : undefined,
            clients,
            yes: flags.yes === true,
            dryRun: flags.dryRun === true,
            repair: flags.repair === true,
            serverName: typeof flags.serverName === "string" ? flags.serverName : undefined,
            config: typeof flags.config === "string" ? flags.config : undefined,
            skills: flags.noSkills === true ? false : undefined,
            overwriteSkills: flags.overwriteSkills === true,
        }, {
            cwd: process.cwd(),
            homeDir: os.homedir(),
            platform: process.platform,
            appDataDir: process.env.APPDATA,
            executablePath,
            commandArgsPrefix,
            env: process.env,
            output: (line) => process.stdout.write(`${line}\n`),
            prompt,
            afterSetupDoctor: async () => {
                await runDoctor({
                    clients,
                    config: typeof flags.config === "string" ? flags.config : undefined,
                    serverName: typeof flags.serverName === "string" ? flags.serverName : undefined,
                }, {
                    cwd: process.cwd(),
                    homeDir: os.homedir(),
                    platform: process.platform,
                    appDataDir: process.env.APPDATA,
                    executablePath,
                    commandArgsPrefix,
                    env: process.env,
                    output: (line) => process.stdout.write(`${line}\n`),
                });
            },
        });
    }
    finally {
        prompt.close?.();
    }
    return 0;
}
