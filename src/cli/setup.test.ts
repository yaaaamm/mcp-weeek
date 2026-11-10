import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { SKILL_NAMES } from "../skills/catalog.js";
import { runSetup, type SetupDependencies } from "./commands/setup.js";

async function projectFixture(options?: { conflict?: boolean }): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mcp-weeek-setup-"));
  await mkdir(path.join(root, ".git"), { recursive: true });
  await mkdir(path.join(root, "apps", "api"), { recursive: true });
  await writeFile(
    path.join(root, "apps", "api", ".env"),
    [
      "WEEEK_API_TOKEN=setup-secret",
      "DATABASE_URL=postgres://database-secret",
      "JWT_SECRET=jwt-secret",
      "SSH_PRIVATE_KEY=ssh-secret",
      "",
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(root, ".mcp.json"),
    JSON.stringify(
      {
        mcpServers: options?.conflict
          ? { weeek: { command: "/opt/foreign" } }
          : { other: { type: "stdio", command: "/opt/other", args: [] } },
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  return root;
}

function dependencies(root: string, output: string[]): SetupDependencies {
  return {
    cwd: root,
    homeDir: root,
    platform: "darwin",
    executablePath: "/opt/bin/mcp-weeek",
    env: {},
    output: (line) => output.push(line),
    prompt: {
      ask: async () => {
        throw new Error("Unexpected interactive prompt");
      },
      confirm: async () => {
        throw new Error("Unexpected interactive confirmation");
      },
    },
    validateBoard: async ({ binding, token }) => {
      assert.equal(binding.boardId, 3);
      assert.equal(token, "setup-secret");
    },
    isTracked: async (filePath) => filePath.endsWith(".mcp.json"),
  };
}

const baseFlags = {
  boardUrl: "https://app.weeek.net/ws/12345/project/2/board/3",
  envFile: "apps/api/.env",
  clients: ["codex", "claude-code", "antigravity"] as const,
  yes: true,
};

test("setup writes canonical and client configs without leaking secrets", async () => {
  const root = await projectFixture();
  const output: string[] = [];
  let doctorRuns = 0;
  const deps = dependencies(root, output);
  deps.afterSetupDoctor = async () => {
    doctorRuns += 1;
  };
  const result = await runSetup(baseFlags, deps);

  assert.equal(result.changes.filter((change) => change.status !== "unchanged").length, 3);
  const canonical = JSON.parse(await readFile(path.join(root, ".weeek-mcp.json"), "utf8"));
  assert.deepEqual(canonical, {
    version: 1,
    boardUrl: "https://app.weeek.net/ws/12345/project/2/board/3",
    auth: {
      source: "env-file",
      file: "apps/api/.env",
      variable: "WEEEK_API_TOKEN",
    },
  });

  const claude = JSON.parse(await readFile(path.join(root, ".mcp.json"), "utf8"));
  assert.equal(claude.mcpServers.other.command, "/opt/other");
  assert.equal(claude.mcpServers.weeek.command, "/opt/bin/mcp-weeek");
  assert.match(await readFile(path.join(root, ".codex", "config.toml"), "utf8"), /mcp-weeek/);
  assert.equal(
    JSON.parse(await readFile(path.join(root, ".agents", "mcp_config.json"), "utf8"))
      .mcpServers.weeek.command,
    "/opt/bin/mcp-weeek"
  );

  const serialized = [
    ...output,
    await readFile(path.join(root, ".weeek-mcp.json"), "utf8"),
    await readFile(path.join(root, ".mcp.json"), "utf8"),
  ].join("\n");
  assert.doesNotMatch(serialized, /setup-secret|database-secret|jwt-secret|ssh-secret/);
  assert.match(serialized, /tracked/);
  assert.equal(doctorRuns, 1);

  const second = await runSetup(baseFlags, dependencies(root, []));
  assert.equal(second.canonicalStatus, "unchanged");
  assert.equal(second.changes.every((change) => change.status === "unchanged"), true);
});

test("setup installs weeek skills for the selected clients and skips them with --no-skills", async () => {
  const root = await projectFixture();
  const output: string[] = [];
  const result = await runSetup(baseFlags, dependencies(root, output));

  assert.equal(result.skillChanges.length, SKILL_NAMES.length * 3);
  assert.equal(result.skillChanges.every((change) => change.status === "added"), true);
  const claudeInit = await readFile(
    path.join(root, ".claude", "skills", "weeek-init", "SKILL.md"),
    "utf8"
  );
  assert.match(claudeInit, /^name: weeek-init$/m);
  assert.doesNotMatch(claudeInit, /\{\{/);
  assert.match(
    await readFile(path.join(root, ".codex", "skills", "weeek-any", "SKILL.md"), "utf8"),
    /AGENTS\.md/
  );
  await access(path.join(root, ".agents", "skills", "weeek-release", "SKILL.md"));
  assert.match(output.join("\n"), /claude-code skill weeek-init: added/);

  const rerun = await runSetup(baseFlags, dependencies(root, []));
  assert.equal(rerun.skillChanges.every((change) => change.status === "unchanged"), true);

  const fresh = await projectFixture();
  const skipped = await runSetup(
    { ...baseFlags, skills: false },
    dependencies(fresh, [])
  );
  assert.deepEqual(skipped.skillChanges, []);
  await assert.rejects(() => access(path.join(fresh, ".claude", "skills")));
});

test("dry-run validates and previews without writing", async () => {
  const root = await projectFixture();
  const before = await readFile(path.join(root, ".mcp.json"), "utf8");
  const result = await runSetup(
    { ...baseFlags, dryRun: true },
    dependencies(root, [])
  );

  assert.equal(result.dryRun, true);
  await assert.rejects(() => access(path.join(root, ".weeek-mcp.json")));
  assert.equal(await readFile(path.join(root, ".mcp.json"), "utf8"), before);
  await assert.rejects(() => access(path.join(root, ".codex", "config.toml")));
  assert.equal(result.skillChanges.length > 0, true);
  await assert.rejects(() => access(path.join(root, ".claude", "skills")));
});

test("client conflict aborts before canonical config is written", async () => {
  const root = await projectFixture({ conflict: true });
  await assert.rejects(
    () => runSetup(baseFlags, dependencies(root, [])),
    { code: "CLIENT_CONFIG_CONFLICT" }
  );
  await assert.rejects(() => access(path.join(root, ".weeek-mcp.json")));
});

test("repair updates managed executable paths without changing board binding", async () => {
  const root = await projectFixture();
  await runSetup(baseFlags, dependencies(root, []));
  const canonicalBefore = await readFile(path.join(root, ".weeek-mcp.json"), "utf8");
  const claudePath = path.join(root, ".mcp.json");
  await writeFile(
    claudePath,
    (await readFile(claudePath, "utf8")).replaceAll(
      "/opt/bin/mcp-weeek",
      "/obsolete/bin/mcp-weeek"
    ),
    "utf8"
  );
  const deps = dependencies(root, []);
  deps.executablePath = "/new/bin/mcp-weeek";

  await runSetup(
    {
      repair: true,
      clients: ["claude-code"],
      yes: true,
    },
    deps
  );

  assert.equal(await readFile(path.join(root, ".weeek-mcp.json"), "utf8"), canonicalBefore);
  assert.match(await readFile(claudePath, "utf8"), /\/new\/bin\/mcp-weeek/);
  assert.doesNotMatch(await readFile(claudePath, "utf8"), /obsolete/);
});
