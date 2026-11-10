import assert from "node:assert/strict";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "mcp-weeek-package-"));
const packDirectory = path.join(temporaryRoot, "pack");
const prefix = path.join(temporaryRoot, "prefix");

try {
  await mkdir(packDirectory, { recursive: true });
  const packed = await execFileAsync(
    "npm",
    ["pack", "--json", "--pack-destination", packDirectory],
    { cwd: repositoryRoot, maxBuffer: 10 * 1024 * 1024 }
  );
  if (process.platform !== "win32") {
    await access(path.join(repositoryRoot, "dist", "cli.js"), fsConstants.X_OK);
  }
  const jsonStart = packed.stdout.lastIndexOf("\n[");
  const packResult = JSON.parse(
    jsonStart === -1 ? packed.stdout : packed.stdout.slice(jsonStart + 1)
  );
  assert.equal(Array.isArray(packResult), true);
  const packedPaths = packResult[0].files.map((file) => file.path);
  assert.equal(
    packedPaths.some((filePath) => filePath.includes("create-subtask-report")),
    false
  );
  assert.equal(packedPaths.some((filePath) => filePath.includes(".test.")), false);
  assert.equal(
    packedPaths.includes("dist/skills/templates/weeek-init/SKILL.md"),
    true,
    "skill templates must ship inside the package"
  );
  const tarball = path.join(packDirectory, packResult[0].filename);
  await access(tarball);

  await execFileAsync("npm", ["install", "--global", "--prefix", prefix, tarball], {
    cwd: temporaryRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  const executable =
    process.platform === "win32"
      ? path.join(prefix, "mcp-weeek.cmd")
      : path.join(prefix, "bin", "mcp-weeek");
  await access(executable);
  const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  const { SERVER_VERSION } = await import(
    pathToFileURL(path.join(repositoryRoot, "dist", "version.js")).href
  );
  assert.equal(packageJson.version, SERVER_VERSION);
  const npmRoot = await execFileAsync("npm", ["root", "--global", "--prefix", prefix]);
  const installedCli = path.join(npmRoot.stdout.trim(), packageJson.name, "dist", "cli.js");
  await access(installedCli);
  const help = await execFileAsync(process.execPath, [installedCli, "--help"], {
    cwd: temporaryRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  for (const command of ["setup", "doctor", "init-board", "serve"]) {
    assert.match(help.stdout, new RegExp(`\\b${command}\\b`));
  }

  const projectRoot = path.join(temporaryRoot, "project");
  await mkdir(path.join(projectRoot, ".git"), { recursive: true });
  await mkdir(path.join(projectRoot, "apps", "api"), { recursive: true });
  const configPath = path.join(projectRoot, ".weeek-mcp.json");
  const envPath = path.join(projectRoot, "apps", "api", ".env");
  const secretValues = [
    "package-secret",
    "database-secret",
    "jwt-secret",
    "ssh-secret",
  ];
  await writeFile(
    envPath,
    [
      `WEEEK_API_TOKEN=${secretValues[0]}`,
      `DATABASE_URL=postgres://${secretValues[1]}`,
      `JWT_SECRET=${secretValues[2]}`,
      `SSH_PRIVATE_KEY=${secretValues[3]}`,
      "",
    ].join("\n"),
    "utf8"
  );

  const { REQUIRED_ROLES, ROLE_COLUMN_NAMES } = await import(
    pathToFileURL(path.join(repositoryRoot, "dist", "constants.js")).href
  );
  const fetchMockPath = path.join(temporaryRoot, "mock-fetch.mjs");
  await writeFile(
    fetchMockPath,
    `const columns = ${JSON.stringify(
      REQUIRED_ROLES.map((role) => ROLE_COLUMN_NAMES[role])
    )};
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  let body = { success: true };
  if (url.pathname.endsWith("/tm/boards")) {
    body = { success: true, boards: [{ id: 30, projectId: 20 }] };
  } else if (url.pathname.endsWith("/tm/board-columns")) {
    body = {
      success: true,
      boardColumns: columns.map((name, index) => ({ id: index + 1, boardId: 30, name })),
    };
  } else if (url.pathname.endsWith("/tm/tasks")) {
    body = {
      success: true,
      tasks: [{
        customFields: [
          { id: "ai-report", name: "ИИ-отчёт", type: "text" },
          { id: "ai-dialog", name: "ИИ-диалог", type: "text" },
        ],
      }],
    };
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
`,
    "utf8"
  );
  const runInstalled = (args) =>
    execFileAsync(
      process.execPath,
      ["--import", pathToFileURL(fetchMockPath).href, installedCli, ...args],
      {
        cwd: projectRoot,
        maxBuffer: 10 * 1024 * 1024,
        // Иначе smoke сходил бы в GitHub и мог переустановить глобальный пакет
        // прямо во время теста.
        env: { ...process.env, MCP_WEEEK_SELF_CHECKED: "1" },
      }
    );
  const setupArgs = [
    "setup",
    "--board-url",
    "https://app.weeek.net/ws/10/project/20/board/30",
    "--env-file",
    "apps/api/.env",
    "--clients",
    "codex,claude-code,antigravity",
    "--yes",
  ];
  const dryRun = await runInstalled([...setupArgs, "--dry-run"]);
  assert.match(dryRun.stdout, /Project config: added/);
  for (const filePath of [
    configPath,
    path.join(projectRoot, ".codex", "config.toml"),
    path.join(projectRoot, ".mcp.json"),
    path.join(projectRoot, ".agents", "mcp_config.json"),
    path.join(projectRoot, ".claude", "skills", "weeek-init", "SKILL.md"),
  ]) {
    await assert.rejects(() => access(filePath));
  }

  const setup = await runInstalled(setupArgs);
  const doctor = await runInstalled([
    "doctor",
    "--clients",
    "codex,claude-code,antigravity",
  ]);
  assert.match(doctor.stdout, /\[PASS\] handshake/);
  assert.match(doctor.stdout, /\[PASS\] skills/);

  for (const [directory, agentDoc] of [
    [".claude", "CLAUDE.md"],
    [".codex", "AGENTS.md"],
    [".agents", "AGENTS.md"],
  ]) {
    for (const skill of [
      "weeek-init",
      "weeek-errors",
      "weeek-tasks",
      "weeek-any",
      "weeek-rework",
      "weeek-changelog-update",
      "weeek-release",
    ]) {
      const skillFile = path.join(projectRoot, directory, "skills", skill, "SKILL.md");
      const contents = await readFile(skillFile, "utf8");
      assert.match(contents, new RegExp(`^name: ${skill}$`, "m"));
      assert.doesNotMatch(contents, /\{\{|\}\}/);
    }
    const any = await readFile(
      path.join(projectRoot, directory, "skills", "weeek-any", "SKILL.md"),
      "utf8"
    );
    assert.match(any, new RegExp(agentDoc.replace(".", "\\.")));
  }

  const generated = await Promise.all([
    readFile(configPath, "utf8"),
    readFile(path.join(projectRoot, ".codex", "config.toml"), "utf8"),
    readFile(path.join(projectRoot, ".mcp.json"), "utf8"),
    readFile(path.join(projectRoot, ".agents", "mcp_config.json"), "utf8"),
  ]);
  const inspectedText = [
    dryRun.stdout,
    dryRun.stderr,
    setup.stdout,
    setup.stderr,
    doctor.stdout,
    doctor.stderr,
    ...generated,
  ].join("\n");
  for (const secret of secretValues) assert.doesNotMatch(inspectedText, new RegExp(secret));

  await writeFile(
    envPath,
    `WEEEK_API_TOKEN=${secretValues[0]}\n`,
    "utf8"
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [installedCli, "serve", "--config", configPath],
    cwd: projectRoot,
    stderr: "pipe",
  });
  const client = new Client({ name: "package-smoke", version: "1.0.0" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "weeek_list_pending_tasks"));
    assert.ok(tools.tools.some((tool) => tool.name === "weeek_list_rework_tasks"));
    assert.ok(tools.tools.some((tool) => tool.name === "weeek_ask_question"));
    assert.ok(tools.tools.some((tool) => tool.name === "weeek_finish_task"));
  } finally {
    await client.close();
  }
  process.stdout.write("Packed global CLI smoke passed.\n");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
