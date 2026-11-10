import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { applyClientChanges } from "../files/atomic-write.js";
import { SKILL_NAMES, skillTemplatesDir } from "./catalog.js";
import { planSkillChanges } from "./plan.js";

async function projectRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "mcp-weeek-skills-"));
}

test("every catalogued skill has a template on disk", async () => {
  const entries = await readdir(skillTemplatesDir(), { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.deepEqual([...directories].sort(), [...SKILL_NAMES].sort());
});

test("plan installs every skill per client into the client's own directory", async () => {
  const root = await projectRoot();
  const changes = await planSkillChanges({
    clients: ["claude-code", "codex", "antigravity"],
    projectRoot: root,
  });

  assert.equal(changes.length, SKILL_NAMES.length * 3);
  assert.equal(changes.every((change) => change.status === "added"), true);
  assert.equal(changes.every((change) => change.before === ""), true);

  const paths = changes.map((change) => path.relative(root, change.path));
  assert.ok(paths.includes(path.join(".claude", "skills", "weeek-init", "SKILL.md")));
  assert.ok(paths.includes(path.join(".codex", "skills", "weeek-release", "SKILL.md")));
  assert.ok(paths.includes(path.join(".agents", "skills", "weeek-rework", "SKILL.md")));
});

test("claude-desktop gets no project skills", async () => {
  const root = await projectRoot();
  const changes = await planSkillChanges({ clients: ["claude-desktop"], projectRoot: root });
  assert.deepEqual(changes, []);
});

test("rendered skills resolve placeholders per client and leave none behind", async () => {
  const root = await projectRoot();
  const changes = await planSkillChanges({
    clients: ["claude-code", "codex"],
    projectRoot: root,
  });

  for (const change of changes) assert.doesNotMatch(change.after, /\{\{|\}\}/);

  const claudeAny = changes.find(
    (change) => change.client === "claude-code" && change.skill === "weeek-any"
  );
  const codexAny = changes.find(
    (change) => change.client === "codex" && change.skill === "weeek-any"
  );
  assert.ok(claudeAny && codexAny);
  assert.match(claudeAny.after, /CLAUDE\.md/);
  assert.match(claudeAny.after, /\.claude\/rules\//);
  assert.doesNotMatch(claudeAny.after, /AGENTS\.md/);
  assert.match(codexAny.after, /AGENTS\.md/);
  assert.match(codexAny.after, /\.codex\/rules\//);
  assert.doesNotMatch(codexAny.after, /CLAUDE\.md/);
});

test("skills carry no leftover host-project specifics", async () => {
  const changes = await planSkillChanges({
    clients: ["claude-code"],
    projectRoot: await projectRoot(),
  });
  for (const change of changes) {
    assert.doesNotMatch(change.after, /pnpm type-check|pnpm lint/);
    assert.doesNotMatch(change.after, /apps\/web\/components|apps\/api\/src\/modules/);
  }
});

test("re-planning after apply reports unchanged, edited files report updated", async () => {
  const root = await projectRoot();
  const first = await planSkillChanges({ clients: ["claude-code"], projectRoot: root });
  await applyClientChanges(first);

  const second = await planSkillChanges({ clients: ["claude-code"], projectRoot: root });
  assert.equal(second.every((change) => change.status === "unchanged"), true);
  assert.equal(
    await readFile(second[0].path, "utf8"),
    second[0].after
  );

  await writeFile(second[0].path, "stale local copy\n", "utf8");
  const third = await planSkillChanges({ clients: ["claude-code"], projectRoot: root });
  const edited = third.find((change) => change.path === second[0].path);
  assert.equal(edited?.status, "updated");
  assert.equal(edited?.before, "stale local copy\n");
  assert.equal(
    third.filter((change) => change.status === "unchanged").length,
    SKILL_NAMES.length - 1
  );
});

test("apply creates nested skill directories that do not exist yet", async () => {
  const root = await projectRoot();
  await mkdir(path.join(root, ".claude"), { recursive: true });
  const changes = await planSkillChanges({ clients: ["antigravity"], projectRoot: root });
  await applyClientChanges(changes);
  for (const change of changes) {
    assert.equal(await readFile(change.path, "utf8"), change.after);
  }
});
