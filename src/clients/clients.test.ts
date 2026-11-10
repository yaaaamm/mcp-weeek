import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { applyClientChanges } from "../files/atomic-write.js";
import { planClientChanges } from "./plan.js";

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mcp-weeek-clients-"));
  await mkdir(path.join(root, ".codex"), { recursive: true });
  await mkdir(path.join(root, ".agents"), { recursive: true });
  await writeFile(
    path.join(root, ".mcp.json"),
    JSON.stringify(
      {
        projectSetting: true,
        mcpServers: {
          other: { type: "stdio", command: "/opt/other", args: [] },
        },
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  await writeFile(
    path.join(root, ".agents", "mcp_config.json"),
    JSON.stringify({ mcpServers: { other: { command: "/opt/other" } } }, null, 2) + "\n",
    "utf8"
  );
  await writeFile(
    path.join(root, ".codex", "config.toml"),
    '# keep this comment\nmodel = "gpt-test"\n\n[mcp_servers.other]\ncommand = "/opt/other"\n',
    "utf8"
  );
  return root;
}

test("plans portable client-specific entries while preserving unrelated config", async () => {
  const root = await fixture();
  const changes = await planClientChanges({
    clients: ["codex", "claude-code", "antigravity"],
    projectRoot: root,
    configPath: path.join(root, ".weeek-mcp.json"),
    executablePath: "/opt/bin/mcp-weeek",
    serverName: "weeek",
    homeDir: root,
    platform: "darwin",
    isTracked: async () => false,
  });

  const claude = changes.find((change) => change.client === "claude-code")!;
  const claudeJson = JSON.parse(claude.after);
  assert.equal(claudeJson.projectSetting, true);
  assert.equal(claudeJson.mcpServers.other.command, "/opt/other");
  assert.deepEqual(claudeJson.mcpServers.weeek, {
    type: "stdio",
    command: "/opt/bin/mcp-weeek",
    args: ["serve"],
  });

  const antigravity = changes.find((change) => change.client === "antigravity")!;
  const antigravityJson = JSON.parse(antigravity.after);
  assert.equal(antigravityJson.mcpServers.other.command, "/opt/other");
  assert.deepEqual(antigravityJson.mcpServers.weeek, {
    command: "/opt/bin/mcp-weeek",
    args: ["serve"],
  });

  const codex = changes.find((change) => change.client === "codex")!;
  assert.match(codex.after, /# keep this comment/);
  assert.match(codex.after, /\[mcp_servers\.other\]/);
  assert.match(codex.after, /# >>> mcp-weeek managed: weeek/);
  assert.match(codex.after, /command = "\/opt\/bin\/mcp-weeek"/);
  assert.equal(changes.every((change) => change.status === "added"), true);
});

test("refuses to overwrite a same-name foreign MCP server before writes", async () => {
  const root = await fixture();
  await writeFile(
    path.join(root, ".mcp.json"),
    JSON.stringify({ mcpServers: { weeek: { command: "/opt/not-ours" } } }),
    "utf8"
  );

  await assert.rejects(
    () =>
      planClientChanges({
        clients: ["claude-code"],
        projectRoot: root,
        configPath: path.join(root, ".weeek-mcp.json"),
        executablePath: "/opt/bin/mcp-weeek",
        serverName: "weeek",
        homeDir: root,
        platform: "darwin",
        isTracked: async () => false,
      }),
    { code: "CLIENT_CONFIG_CONFLICT" }
  );
});

test("recognizes unchanged managed entries and tracked machine-local files", async () => {
  const root = await fixture();
  const options = {
    clients: ["codex", "claude-code", "antigravity"] as const,
    projectRoot: root,
    configPath: path.join(root, ".weeek-mcp.json"),
    executablePath: "/opt/bin/mcp-weeek",
    serverName: "weeek",
    homeDir: root,
    platform: "darwin" as const,
    isTracked: async (filePath: string) => filePath.endsWith(".mcp.json"),
  };
  const first = await planClientChanges(options);
  await applyClientChanges(first);
  const second = await planClientChanges(options);

  assert.equal(second.every((change) => change.status === "unchanged"), true);
  assert.equal(
    second.find((change) => change.client === "claude-code")?.tracked,
    true
  );
});

test("Claude Desktop uses an absolute project config and creates a backup", async () => {
  const root = await fixture();
  const desktopDir = path.join(root, "Library", "Application Support", "Claude");
  await mkdir(desktopDir, { recursive: true });
  const desktopPath = path.join(desktopDir, "claude_desktop_config.json");
  await writeFile(
    desktopPath,
    JSON.stringify({ mcpServers: { other: { command: "/opt/other" } } }, null, 2) + "\n",
    "utf8"
  );
  const [change] = await planClientChanges({
    clients: ["claude-desktop"],
    projectRoot: root,
    configPath: path.join(root, ".weeek-mcp.json"),
    executablePath: "/opt/bin/mcp-weeek",
    serverName: "weeek-project",
    homeDir: root,
    platform: "darwin",
    isTracked: async () => false,
  });

  assert.equal(change.path, desktopPath);
  assert.equal(change.backup, true);
  assert.deepEqual(JSON.parse(change.after).mcpServers["weeek-project"], {
    type: "stdio",
    command: "/opt/bin/mcp-weeek",
    args: ["serve", "--config", path.join(root, ".weeek-mcp.json")],
  });

  await applyClientChanges([change]);
  assert.equal(JSON.parse(await readFile(desktopPath, "utf8")).mcpServers.other.command, "/opt/other");
  const files = await readdir(desktopDir);
  const backup = files.find((name) => name.startsWith("claude_desktop_config.json.bak-"));
  assert.ok(backup);
  await access(path.join(desktopDir, backup));
});

test("supports an absolute Node command with a CLI path prefix", async () => {
  const root = await fixture();
  const options = {
    clients: ["antigravity"],
    projectRoot: root,
    configPath: path.join(root, ".weeek-mcp.json"),
    executablePath: "/opt/node/bin/node",
    commandArgsPrefix: ["/opt/lib/mcp-weeek/dist/cli.js"],
    serverName: "weeek",
    homeDir: root,
    platform: "win32" as const,
    isTracked: async () => false,
  };
  const [change] = await planClientChanges(options);

  assert.deepEqual(JSON.parse(change.after).mcpServers.weeek, {
    command: "/opt/node/bin/node",
    args: ["/opt/lib/mcp-weeek/dist/cli.js", "serve"],
  });

  await applyClientChanges([change]);
  const [repeated] = await planClientChanges(options);
  assert.equal(repeated.status, "unchanged");
});

test("rolls back earlier client writes when a later atomic write fails", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mcp-weeek-rollback-"));
  const firstPath = path.join(root, "first.json");
  const blockedParent = path.join(root, "not-a-directory");
  await writeFile(firstPath, "before\n", "utf8");
  await writeFile(blockedParent, "blocker\n", "utf8");

  await assert.rejects(() =>
    applyClientChanges([
      {
        client: "claude-code",
        path: firstPath,
        before: "before\n",
        after: "after\n",
        status: "updated",
        backup: false,
        tracked: false,
      },
      {
        client: "antigravity",
        path: path.join(blockedParent, "config.json"),
        before: "",
        after: "{}\n",
        status: "added",
        backup: false,
        tracked: false,
      },
    ])
  );

  assert.equal(await readFile(firstPath, "utf8"), "before\n");
});
