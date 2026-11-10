import os from "node:os";
import path from "node:path";
import { McpWeeekError } from "../../errors.js";
import { SERVER_VERSION } from "../../version.js";
import type { ClientName } from "../../clients/types.js";
import type { CliFlags } from "../args.js";
import { createPrompt } from "../prompt.js";
import {
  installSelf,
  refreshSelf,
  selfRefreshDependencies,
  SELF_INSTALL_SOURCE,
} from "../self-update.js";
import { runSetup, type SetupDependencies, type SetupResult } from "./setup.js";

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
export async function runUpdate(
  flags: UpdateFlags,
  dependencies: UpdateDependencies
): Promise<SetupResult> {
  if (flags.self) {
    dependencies.output(`Reinstalling mcp-weeek from ${SELF_INSTALL_SOURCE} ...`);
    try {
      await (dependencies.installSelf ?? (() => installSelf()))(SELF_INSTALL_SOURCE);
    } catch (error) {
      throw new McpWeeekError(
        "CONFIG_INVALID",
        `Self-update failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    dependencies.output(
      "mcp-weeek reinstalled. Rerun `mcp-weeek update` so the project picks up the new version."
    );
    return {
      projectRoot: dependencies.cwd,
      configPath: "",
      canonicalStatus: "unchanged",
      changes: [],
      skillChanges: [],
      skippedSkills: [],
      dryRun: true,
    };
  }

  dependencies.output(`mcp-weeek ${SERVER_VERSION}`);
  return runSetup(
    {
      repair: true,
      yes: true,
      clients: flags.clients,
      config: flags.config,
      serverName: flags.serverName,
      skills: flags.skills,
      overwriteSkills: flags.overwriteSkills,
      dryRun: flags.dryRun,
    },
    dependencies
  );
}

function parseClients(value: string | boolean | undefined): readonly ClientName[] | undefined {
  if (typeof value !== "string") return undefined;
  return value.split(",").map((client) => client.trim()) as ClientName[];
}

export async function runUpdateCommand(flags: CliFlags): Promise<number> {
  if (flags.self !== true && flags.noSelfUpdate !== true) {
    const exitCode = await refreshSelf(selfRefreshDependencies());
    if (exitCode !== null) return exitCode;
  }
  const prompt = createPrompt();
  try {
    await runUpdate(
      {
        clients: parseClients(flags.clients),
        config: typeof flags.config === "string" ? flags.config : undefined,
        serverName: typeof flags.serverName === "string" ? flags.serverName : undefined,
        skills: flags.noSkills === true ? false : undefined,
        overwriteSkills: flags.overwriteSkills === true,
        dryRun: flags.dryRun === true,
        self: flags.self === true,
      },
      {
        cwd: process.cwd(),
        homeDir: os.homedir(),
        platform: process.platform,
        appDataDir: process.env.APPDATA,
        executablePath: process.execPath,
        commandArgsPrefix: [path.resolve(process.argv[1])],
        env: process.env,
        output: (line) => process.stdout.write(`${line}\n`),
        prompt,
      }
    );
  } finally {
    prompt.close?.();
  }
  return 0;
}
