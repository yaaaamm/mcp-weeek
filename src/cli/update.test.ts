import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { applyMarker, ownershipOf } from "../skills/marker.js";
import { runSetup, type SetupDependencies } from "./commands/setup.js";
import { runUpdate, SELF_INSTALL_ARGS, SELF_INSTALL_SOURCE } from "./commands/update.js";

async function projectFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mcp-weeek-update-"));
  await mkdir(path.join(root, ".git"), { recursive: true });
  await writeFile(path.join(root, ".env"), "WEEEK_API_TOKEN=update-secret\n", "utf8");
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
    validateBoard: async () => undefined,
    isTracked: async () => false,
  };
}

const installFlags = {
  boardUrl: "https://app.weeek.net/ws/12345/project/2/board/3",
  envFile: ".env",
  clients: ["claude-code"] as const,
  yes: true,
};

async function installed(root: string): Promise<void> {
  await runSetup(installFlags, dependencies(root, []));
}

function skillPath(root: string, skill = "weeek-tasks"): string {
  return path.join(root, ".claude", "skills", skill, "SKILL.md");
}

test("installed skills carry the managed marker", async () => {
  const root = await projectFixture();
  await installed(root);
  const contents = await readFile(skillPath(root), "utf8");
  assert.match(contents, /^x-mcp-weeek: \d+\.\d+\.\d+ [0-9a-f]{16}$/m);
  assert.equal(ownershipOf(contents), "managed");
});

test("update refreshes an outdated managed skill without asking", async () => {
  const root = await projectFixture();
  await installed(root);
  const target = skillPath(root);
  // Файл от прошлой версии: помечен инструментом, человеком не тронут.
  const previous = applyMarker("---\nname: weeek-tasks\n---\n\nСтарый текст.\n", "1.7.0");
  await writeFile(target, previous, "utf8");

  const output: string[] = [];
  const result = await runUpdate({ clients: ["claude-code"] }, dependencies(root, output));

  const change = result.skillChanges.find((item) => item.path === target);
  assert.equal(change?.ownership, "managed");
  assert.equal(change?.installedVersion, "1.7.0");
  assert.equal(result.skippedSkills.length, 0);
  assert.match(await readFile(target, "utf8"), /weeek_list_pending_tasks/);
  assert.equal(ownershipOf(await readFile(target, "utf8")), "managed");
});

test("update keeps a hand-edited skill and says how to replace it", async () => {
  const root = await projectFixture();
  await installed(root);
  const target = skillPath(root);
  const edited = (await readFile(target, "utf8")).replace(
    "## Шаги",
    "## Шаги\n\nНаше правило: сначала спроси Олю."
  );
  await writeFile(target, edited, "utf8");

  const output: string[] = [];
  const result = await runUpdate({ clients: ["claude-code"] }, dependencies(root, output));

  assert.equal(result.skippedSkills.length, 1);
  assert.equal(result.skippedSkills[0].ownership, "modified");
  assert.equal(await readFile(target, "utf8"), edited);
  assert.match(output.join("\n"), /--overwrite-skills/);

  const forced = await runUpdate(
    { clients: ["claude-code"], overwriteSkills: true },
    dependencies(root, [])
  );
  assert.equal(forced.skippedSkills.length, 0);
  assert.doesNotMatch(await readFile(target, "utf8"), /сначала спроси Олю/);
});

test("update adopts hand-copied skills only when told to", async () => {
  const root = await projectFixture();
  await installed(root);
  const target = skillPath(root);
  // Копия, положенная руками до появления установщика: пометки нет вовсе.
  await writeFile(target, "---\nname: weeek-tasks\n---\n\nРучная копия.\n", "utf8");

  const kept = await runUpdate({ clients: ["claude-code"] }, dependencies(root, []));
  assert.equal(kept.skippedSkills[0]?.ownership, "foreign");
  assert.match(await readFile(target, "utf8"), /Ручная копия/);

  await runUpdate(
    { clients: ["claude-code"], overwriteSkills: true },
    dependencies(root, [])
  );
  assert.equal(ownershipOf(await readFile(target, "utf8")), "managed");
});

test("update is a no-op right after setup", async () => {
  const root = await projectFixture();
  await installed(root);
  const output: string[] = [];
  const result = await runUpdate({ clients: ["claude-code"] }, dependencies(root, output));

  assert.equal(result.canonicalStatus, "unchanged");
  assert.equal(result.skillChanges.every((change) => change.status === "unchanged"), true);
  assert.equal(result.changes.every((change) => change.status === "unchanged"), true);
});

test("update --self reinstalls the tool from the repository and writes nothing", async () => {
  const root = await projectFixture();
  await installed(root);
  const output: string[] = [];
  const sources: string[] = [];
  const deps = dependencies(root, output);

  const result = await runUpdate(
    { self: true },
    { ...deps, installSelf: async (source) => void sources.push(source) }
  );

  assert.deepEqual(sources, [SELF_INSTALL_SOURCE]);
  assert.ok(SELF_INSTALL_ARGS.includes(SELF_INSTALL_SOURCE));
  assert.equal(result.skillChanges.length, 0);
  assert.match(output.join("\n"), /Rerun `mcp-weeek update`/);
});

test("a failing self-update reports a stable error instead of a raw npm dump", async () => {
  const root = await projectFixture();
  const deps = dependencies(root, []);
  await assert.rejects(
    () =>
      runUpdate(
        { self: true },
        {
          ...deps,
          installSelf: async () => {
            throw new Error("npm ERR! code 128");
          },
        }
      ),
    { code: "CONFIG_INVALID" }
  );
});
