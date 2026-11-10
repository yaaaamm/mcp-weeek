import { access, constants as fsConstants } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { normalizeName } from "../../board-schema.js";
import { planClientChanges } from "../../clients/plan.js";
import type { ClientName } from "../../clients/types.js";
import { discoverConfig } from "../../config/discover.js";
import { loadProjectConfig } from "../../config/load.js";
import { resolveToken } from "../../config/token-source.js";
import {
  REQUIRED_CUSTOM_FIELD_NAMES,
  REQUIRED_ROLES,
  ROLE_COLUMN_NAMES,
} from "../../constants.js";
import { McpWeeekError, type McpWeeekErrorCode } from "../../errors.js";
import { createMcpServer } from "../../server/create-server.js";
import { createServerContext, type ServerContext } from "../../server-context.js";
import { needsConfirmation, planSkillChanges } from "../../skills/plan.js";
import { validateBoardAccess } from "../../weeek/validate-board.js";
import type { CliFlags } from "../args.js";

const DEFAULT_CLIENTS: readonly ClientName[] = ["codex", "claude-code", "antigravity"];

export type DoctorStatus = "pass" | "warn" | "fail";
export type DoctorCheck = {
  name: string;
  status: DoctorStatus;
  code?: McpWeeekErrorCode;
  message: string;
};
export type DoctorReport = { ok: boolean; checks: DoctorCheck[] };

export type DoctorFlags = {
  clients?: readonly ClientName[];
  config?: string;
  serverName?: string;
};

export type DoctorDependencies = {
  cwd: string;
  homeDir: string;
  platform: NodeJS.Platform;
  appDataDir?: string;
  executablePath: string;
  commandArgsPrefix?: readonly string[];
  env: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
  output: (line: string) => void;
  isTracked?: (filePath: string) => Promise<boolean>;
  handshake?: (context: ServerContext) => Promise<void>;
};

function pass(name: string, message: string): DoctorCheck {
  return { name, status: "pass", message };
}

function fail(name: string, code: McpWeeekErrorCode, message: string): DoctorCheck {
  return { name, status: "fail", code, message };
}

function warn(name: string, message: string): DoctorCheck {
  return { name, status: "warn", message };
}

async function inMemoryHandshake(context: ServerContext): Promise<void> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(context);
  const client = new Client({ name: "mcp-weeek-doctor", version: "1.0.0" });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = await client.listTools();
    const names = new Set(tools.tools.map((tool) => tool.name));
    const requiredTools = [
      "weeek_list_pending_tasks",
      "weeek_list_rework_tasks",
      "weeek_ask_question",
    ];
    if (requiredTools.some((name) => !names.has(name))) {
      throw new Error("Required tool is missing");
    }
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

function render(check: DoctorCheck): string {
  const code = check.code ? ` ${check.code}` : "";
  return `[${check.status.toUpperCase()}] ${check.name}${code}: ${check.message}`;
}

export async function runDoctor(
  flags: DoctorFlags,
  dependencies: DoctorDependencies
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const emit = (check: DoctorCheck) => {
    checks.push(check);
    dependencies.output(render(check));
  };
  let loaded;
  try {
    const configPath = flags.config
      ? path.resolve(dependencies.cwd, flags.config)
      : await discoverConfig(dependencies.cwd, dependencies.env);
    loaded = await loadProjectConfig(configPath);
    emit(pass("config", configPath));
  } catch (error) {
    const code =
      error instanceof McpWeeekError && error.code === "CONFIG_INVALID"
        ? "CONFIG_INVALID"
        : "CONFIG_NOT_FOUND";
    emit(
      fail(
        "config",
        code,
        code === "CONFIG_INVALID"
          ? "Canonical project config is invalid."
          : "Canonical project config is unavailable."
      )
    );
    return { ok: false, checks };
  }

  let token: string;
  try {
    token = await resolveToken(loaded, dependencies.env);
    emit(pass("token", "Configured token source is readable."));
  } catch {
    emit(fail("token", "TOKEN_NOT_FOUND", "Configured Weeek token is unavailable."));
    return { ok: false, checks };
  }

  const context = createServerContext(
    loaded,
    token,
    dependencies.fetch ?? globalThis.fetch
  );
  try {
    await validateBoardAccess({
      binding: loaded.binding,
      token,
      fetch: dependencies.fetch,
    });
    emit(pass("api", `Board ${context.boardId} is accessible.`));
  } catch (error) {
    const code =
      error instanceof McpWeeekError ? error.code : ("WEEEK_AUTH_FAILED" as const);
    emit(fail("api", code, "Weeek board access check failed."));
  }

  try {
    const [columns, fields] = await Promise.all([
      context.boardSchema.getColumns(context.boardId, true),
      context.boardSchema.getCustomFields(context.boardId, true),
    ]);
    const columnNames = new Set(columns.map((column) => normalizeName(column.name)));
    const missingColumns = REQUIRED_ROLES.map((role) => ROLE_COLUMN_NAMES[role]).filter(
      (name) => !columnNames.has(normalizeName(name))
    );
    const missingTextFields = REQUIRED_CUSTOM_FIELD_NAMES.filter(
      (name) =>
        !fields.some(
          (field) =>
            field.type === "text" &&
            field.name != null &&
            normalizeName(field.name) === normalizeName(name)
        )
    );
    if (missingColumns.length || missingTextFields.length) {
      emit(
        fail(
          "board-schema",
          "BOARD_SCHEMA_INCOMPLETE",
          "Run mcp-weeek init-board to create missing workflow objects."
        )
      );
    } else {
      emit(
        pass(
          "board-schema",
          "Required columns, ИИ-отчёт, and ИИ-диалог are present."
        )
      );
    }
  } catch {
    emit(
      fail(
        "board-schema",
        "BOARD_SCHEMA_INCOMPLETE",
        "Could not inspect board workflow objects."
      )
    );
  }

  try {
    const changes = await planClientChanges({
      clients: flags.clients ?? DEFAULT_CLIENTS,
      projectRoot: loaded.rootDir,
      configPath: loaded.path,
      executablePath: dependencies.executablePath,
      commandArgsPrefix: dependencies.commandArgsPrefix,
      serverName: flags.serverName ?? "weeek",
      homeDir: dependencies.homeDir,
      platform: dependencies.platform,
      appDataDir: dependencies.appDataDir,
      isTracked: dependencies.isTracked,
    });
    if (changes.some((change) => change.status !== "unchanged")) {
      emit(
        fail(
          "clients",
          "CLIENT_CONFIG_CONFLICT",
          "Client configuration differs; run mcp-weeek setup --repair."
        )
      );
    } else {
      emit(pass("clients", "Selected MCP client entries are current."));
    }
  } catch {
    emit(
      fail(
        "clients",
        "CLIENT_CONFIG_CONFLICT",
        "Selected MCP client configuration could not be validated."
      )
    );
  }

  try {
    const skillChanges = await planSkillChanges({
      clients: flags.clients ?? DEFAULT_CLIENTS,
      projectRoot: loaded.rootDir,
    });
    const stale = skillChanges.filter((change) => change.status !== "unchanged");
    const guarded = skillChanges.filter(needsConfirmation);
    if (stale.length) {
      const edited = guarded.length ? `, ${guarded.length} edited locally` : "";
      emit(
        warn(
          "skills",
          `${stale.length} skill file(s) missing or outdated${edited}; run mcp-weeek update.`
        )
      );
    } else {
      emit(pass("skills", `Installed weeek skills are current (${skillChanges.length} files).`));
    }
  } catch {
    emit(warn("skills", "Installed weeek skills could not be validated."));
  }

  try {
    await access(
      dependencies.executablePath,
      dependencies.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK
    );
    emit(pass("executable", dependencies.executablePath));
  } catch {
    emit(
      fail(
        "executable",
        "MCP_EXECUTABLE_NOT_FOUND",
        "Installed MCP executable is missing; run mcp-weeek setup --repair."
      )
    );
  }

  try {
    await (dependencies.handshake ?? inMemoryHandshake)(context);
    emit(pass("handshake", "MCP initialize and tools/list succeeded."));
  } catch {
    emit(fail("handshake", "MCP_HANDSHAKE_FAILED", "MCP handshake failed."));
  }

  return { ok: checks.every((check) => check.status !== "fail"), checks };
}

function clientsFromFlag(value: string | boolean | undefined): readonly ClientName[] | undefined {
  if (typeof value !== "string") return undefined;
  return value.split(",").map((client) => client.trim()) as ClientName[];
}

export async function runDoctorCommand(flags: CliFlags): Promise<boolean> {
  const report = await runDoctor(
    {
      clients: clientsFromFlag(flags.clients),
      config: typeof flags.config === "string" ? flags.config : undefined,
      serverName: typeof flags.serverName === "string" ? flags.serverName : undefined,
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
    }
  );
  return report.ok;
}
