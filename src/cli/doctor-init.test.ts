import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { planClientChanges } from "../clients/plan.js";
import { applyClientChanges } from "../files/atomic-write.js";
import { planSkillChanges } from "../skills/plan.js";
import {
  AI_DIALOG_FIELD_NAME,
  AI_REPORT_FIELD_NAME,
  REQUIRED_ROLES,
  ROLE_COLUMN_NAMES,
} from "../constants.js";
import { runDoctor, type DoctorDependencies } from "./commands/doctor.js";
import { runInitBoard, type InitBoardDependencies } from "./commands/init-board.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function canonicalFixture(token = "doctor-secret"): Promise<{
  root: string;
  configPath: string;
  executablePath: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "mcp-weeek-doctor-"));
  await mkdir(path.join(root, ".git"), { recursive: true });
  const configPath = path.join(root, ".weeek-mcp.json");
  await writeFile(
    configPath,
    JSON.stringify({
      version: 1,
      boardUrl: "https://app.weeek.net/ws/10/project/20/board/30",
      auth: { source: "env-file", file: ".env", variable: "WEEEK_API_TOKEN" },
    }),
    "utf8"
  );
  await writeFile(path.join(root, ".env"), `WEEEK_API_TOKEN=${token}\n`, "utf8");
  const executablePath = path.join(root, "bin", "mcp-weeek");
  await mkdir(path.dirname(executablePath), { recursive: true });
  await writeFile(executablePath, "#!/bin/sh\nexit 0\n", "utf8");
  await chmod(executablePath, 0o755);
  const changes = await planClientChanges({
    clients: ["codex", "claude-code", "antigravity"],
    projectRoot: root,
    configPath,
    executablePath,
    serverName: "weeek",
    homeDir: root,
    platform: "darwin",
    isTracked: async () => false,
  });
  await applyClientChanges(changes);
  await applyClientChanges(
    await planSkillChanges({
      clients: ["codex", "claude-code", "antigravity"],
      projectRoot: root,
    })
  );
  return { root, configPath, executablePath };
}

type FieldFixture = { id: string; name: string; type: string; value?: unknown };

const HEALTHY_FIELDS: FieldFixture[] = [
  { id: "ai-report", name: AI_REPORT_FIELD_NAME, type: "text" },
  { id: "ai-dialog", name: AI_DIALOG_FIELD_NAME, type: "text" },
];

function healthyFetch(customFields: FieldFixture[] = HEALTHY_FIELDS): typeof fetch {
  return async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname.endsWith("/tm/boards")) {
      return jsonResponse({ success: true, boards: [{ id: 30, projectId: 20 }] });
    }
    if (url.pathname.endsWith("/tm/board-columns")) {
      return jsonResponse({
        success: true,
        boardColumns: REQUIRED_ROLES.map((role, index) => ({
          id: index + 1,
          boardId: 30,
          name: ROLE_COLUMN_NAMES[role],
        })),
      });
    }
    if (url.pathname.endsWith("/tm/tasks")) {
      return jsonResponse({
        success: true,
        tasks: [
          {
            id: 1,
            customFields,
          },
        ],
      });
    }
    return jsonResponse({ success: true });
  };
}

function doctorDependencies(
  fixture: Awaited<ReturnType<typeof canonicalFixture>>,
  output: string[],
  fetchImpl: typeof fetch = healthyFetch()
): DoctorDependencies {
  return {
    cwd: fixture.root,
    homeDir: fixture.root,
    platform: "darwin",
    executablePath: fixture.executablePath,
    env: {},
    fetch: fetchImpl,
    output: (line) => output.push(line),
    isTracked: async () => false,
  };
}

test("doctor reports a healthy read-only installation and in-memory MCP handshake", async () => {
  const fixture = await canonicalFixture();
  const output: string[] = [];
  const report = await runDoctor(
    { clients: ["codex", "claude-code", "antigravity"] },
    doctorDependencies(fixture, output)
  );

  assert.equal(report.ok, true);
  assert.equal(report.checks.every((check) => check.status === "pass"), true);
  assert.deepEqual(
    report.checks.map((check) => check.name),
    [
      "config",
      "token",
      "api",
      "board-schema",
      "clients",
      "skills",
      "executable",
      "handshake",
    ]
  );
  assert.doesNotMatch(output.join("\n"), /doctor-secret/);
});

test("doctor warns when installed skills are missing or outdated", async () => {
  const fixture = await canonicalFixture();
  const skillPath = path.join(fixture.root, ".claude", "skills", "weeek-tasks", "SKILL.md");
  await writeFile(skillPath, "stale copy\n", "utf8");

  const output: string[] = [];
  const report = await runDoctor(
    { clients: ["claude-code"] },
    doctorDependencies(fixture, output)
  );

  const skills = report.checks.find((check) => check.name === "skills");
  assert.equal(skills?.status, "warn");
  assert.match(skills?.message ?? "", /mcp-weeek update/);
  assert.match(skills?.message ?? "", /1 edited locally/);
  assert.equal(report.ok, true);
});

test("doctor uses stable codes for missing token and executable without leaking values", async () => {
  const fixture = await canonicalFixture("");
  const output: string[] = [];
  const missingToken = await runDoctor(
    { clients: ["codex"] },
    doctorDependencies(fixture, output)
  );
  assert.equal(missingToken.ok, false);
  assert.equal(missingToken.checks.find((check) => check.name === "token")?.code, "TOKEN_NOT_FOUND");

  const healthy = await canonicalFixture();
  const missingExecutable = await runDoctor(
    { clients: ["codex"] },
    {
      ...doctorDependencies(healthy, output),
      executablePath: path.join(healthy.root, "missing", "mcp-weeek"),
    }
  );
  assert.equal(
    missingExecutable.checks.find((check) => check.name === "executable")?.code,
    "MCP_EXECUTABLE_NOT_FOUND"
  );
  assert.doesNotMatch(output.join("\n"), /doctor-secret/);
});

test("doctor distinguishes an invalid config from a missing config", async () => {
  const fixture = await canonicalFixture();
  await writeFile(fixture.configPath, '{"version":2}', "utf8");
  const report = await runDoctor(
    { clients: ["codex"] },
    doctorDependencies(fixture, [])
  );

  assert.equal(report.checks[0].name, "config");
  assert.equal(report.checks[0].code, "CONFIG_INVALID");
});

test("doctor requires a text ИИ-диалог field", async () => {
  const fixture = await canonicalFixture();
  const missing = await runDoctor(
    { clients: ["codex", "claude-code", "antigravity"] },
    doctorDependencies(fixture, [], healthyFetch([HEALTHY_FIELDS[0]]))
  );
  assert.equal(
    missing.checks.find((check) => check.name === "board-schema")?.code,
    "BOARD_SCHEMA_INCOMPLETE"
  );

  const wrongType = await runDoctor(
    { clients: ["codex", "claude-code", "antigravity"] },
    doctorDependencies(
      fixture,
      [],
      healthyFetch([
        HEALTHY_FIELDS[0],
        { id: "ai-dialog", name: AI_DIALOG_FIELD_NAME, type: "select" },
      ])
    )
  );
  assert.equal(
    wrongType.checks.find((check) => check.name === "board-schema")?.code,
    "BOARD_SCHEMA_INCOMPLETE"
  );
});

type MutableBoard = {
  columns: Array<{ id: number; boardId: number; name: string }>;
  fields: FieldFixture[];
  posts: number;
  /**
   * A board's fields are visible only on its tasks, so "no fields" and "no
   * tasks" are different boards: the first is modelled by an empty `fields`,
   * the second by `hasTasks: false`.
   */
  hasTasks?: boolean;
};

function mutableBoardFetch(state: MutableBoard): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname.endsWith("/tm/board-columns")) {
      return jsonResponse({ success: true, boardColumns: state.columns });
    }
    if (request.method === "GET" && url.pathname.endsWith("/tm/tasks")) {
      return jsonResponse({
        success: true,
        tasks: state.hasTasks === false ? [] : [{ customFields: state.fields }],
      });
    }
    if (request.method === "POST" && url.pathname.endsWith("/tm/board-columns")) {
      state.posts += 1;
      const body = JSON.parse(await request.text()) as { boardId: number; name: string };
      const column = { id: 100, boardId: body.boardId, name: body.name };
      state.columns.push(column);
      return jsonResponse({ success: true, boardColumn: column });
    }
    if (request.method === "POST" && url.pathname.endsWith("/custom-fields")) {
      state.posts += 1;
      const body = JSON.parse(await request.text()) as { name: string; type: string };
      const field = {
        id: body.name === AI_REPORT_FIELD_NAME ? "ai-report" : "ai-dialog",
        name: body.name,
        type: body.type,
      };
      state.fields.push(field);
      return jsonResponse({ success: true, customField: field });
    }
    return jsonResponse({ success: true });
  };
}

test("init-board previews, confirms, applies only missing objects, and is idempotent", async () => {
  const fixture = await canonicalFixture();
  const missingRole = "AI_REWORK" as const;
  const state: MutableBoard = {
    columns: REQUIRED_ROLES.filter((role) => role !== missingRole).map(
      (role, index) => ({
        id: index + 1,
        boardId: 30,
        name: ROLE_COLUMN_NAMES[role],
      })
    ),
    fields: [],
    posts: 0,
  };
  const output: string[] = [];
  const base: InitBoardDependencies = {
    cwd: fixture.root,
    env: {},
    fetch: mutableBoardFetch(state),
    output: (line) => output.push(line),
    prompt: { ask: async () => "", confirm: async () => false },
  };

  const previewOnly = await runInitBoard({}, base);
  assert.equal(previewOnly.applied, false);
  assert.equal(state.posts, 0);
  assert.match(output.join("\n"), new RegExp(ROLE_COLUMN_NAMES[missingRole]));
  assert.match(output.join("\n"), new RegExp(AI_REPORT_FIELD_NAME));
  assert.match(output.join("\n"), new RegExp(AI_DIALOG_FIELD_NAME));

  const applied = await runInitBoard(
    { yes: true },
    { ...base, fetch: mutableBoardFetch(state) }
  );
  assert.equal(applied.applied, true);
  assert.equal(state.posts, 3);
  assert.equal(applied.report.createdCount, 3);

  state.posts = 0;
  const repeated = await runInitBoard(
    { yes: true },
    { ...base, fetch: mutableBoardFetch(state) }
  );
  assert.equal(repeated.report.createdCount, 0);
  assert.equal(state.posts, 0);
});

test("init-board preview lists missing intake fields and options and flags type conflicts", async () => {
  const fixture = await canonicalFixture();
  await writeFile(
    fixture.configPath,
    JSON.stringify({
      version: 1,
      boardUrl: "https://app.weeek.net/ws/10/project/20/board/30",
      auth: { source: "env-file", file: ".env", variable: "WEEEK_API_TOKEN" },
      intakeFields: [
        { name: "URL", type: "text" },
        { name: "Раздел", type: "select", options: ["Объекты"] },
      ],
    }),
    "utf8"
  );
  const state: MutableBoard = {
    columns: REQUIRED_ROLES.map((role, index) => ({
      id: index + 1,
      boardId: 30,
      name: ROLE_COLUMN_NAMES[role],
    })),
    fields: [...HEALTHY_FIELDS, { id: "url-select", name: "URL", type: "select" }],
    posts: 0,
  };
  const output: string[] = [];

  const result = await runInitBoard(
    {},
    {
      cwd: fixture.root,
      env: {},
      fetch: mutableBoardFetch(state),
      output: (line) => output.push(line),
      prompt: { ask: async () => "", confirm: async () => false },
    }
  );

  assert.equal(result.applied, false);
  assert.equal(state.posts, 0);
  const printed = output.join("\n");
  assert.match(printed, /- Раздел$/m);
  assert.match(printed, /- Раздел: Объекты$/m);
  assert.match(printed, /URL.*not text/);
});

test("init-board on a board without tasks creates only columns and says how to finish", async () => {
  const fixture = await canonicalFixture();
  const state: MutableBoard = { columns: [], fields: [], posts: 0, hasTasks: false };
  const output: string[] = [];
  const dependencies = (): InitBoardDependencies => ({
    cwd: fixture.root,
    env: {},
    fetch: mutableBoardFetch(state),
    output: (line) => output.push(line),
    prompt: { ask: async () => "", confirm: async () => false },
  });

  const first = await runInitBoard({ yes: true }, dependencies());
  assert.equal(first.applied, true);
  assert.equal(state.posts, REQUIRED_ROLES.length, "создаются только колонки");
  assert.deepEqual(state.fields, []);
  assert.match(output.join("\n"), /has no tasks/);
  assert.match(output.join("\n"), /Create any task on the board/);

  // Колонки уже есть, а поля всё ещё не видны: доска не готова, и CLI не должен
  // говорить обратное.
  output.length = 0;
  state.posts = 0;
  const rerun = await runInitBoard({ yes: true }, dependencies());
  assert.equal(rerun.applied, false);
  assert.equal(state.posts, 0);
  assert.match(output.join("\n"), /has no tasks/);
  assert.doesNotMatch(output.join("\n"), /already initialized/);
});
