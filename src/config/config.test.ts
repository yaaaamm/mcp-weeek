import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parseBoardUrl } from "./board-url.js";
import { discoverConfig } from "./discover.js";
import { loadProjectConfig } from "./load.js";
import { resolveToken } from "./token-source.js";

async function createFixture(config: unknown, envText = ""): Promise<{
  root: string;
  configPath: string;
  nested: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "mcp-weeek-config-"));
  const nested = path.join(root, "apps", "api", "src");
  await mkdir(nested, { recursive: true });
  const configPath = path.join(root, ".weeek-mcp.json");
  await writeFile(configPath, JSON.stringify(config), "utf8");
  await writeFile(path.join(root, "apps", "api", ".env"), envText, "utf8");
  return { root, configPath, nested };
}

test("parses a Weeek board URL into one normalized binding", () => {
  assert.deepEqual(
    parseBoardUrl("https://app.weeek.net/ws/12345/project/2/board/3/"),
    {
      workspaceId: 12345,
      projectId: 2,
      boardId: 3,
      boardUrl: "https://app.weeek.net/ws/12345/project/2/board/3",
    }
  );
  assert.throws(
    () => parseBoardUrl("https://example.com/ws/1/project/2/board/3"),
    { code: "CONFIG_INVALID" }
  );
});

test("discovers and loads canonical config from a nested directory", async () => {
  const fixture = await createFixture({
    version: 1,
    boardUrl: "https://app.weeek.net/ws/12345/project/2/board/3",
    auth: {
      source: "env-file",
      file: "apps/api/.env",
      variable: "WEEEK_API_TOKEN",
    },
  });

  assert.equal(await discoverConfig(fixture.nested, {}), fixture.configPath);
  const loaded = await loadProjectConfig(fixture.configPath);
  assert.equal(loaded.rootDir, fixture.root);
  assert.deepEqual(loaded.binding, {
    workspaceId: 12345,
    projectId: 2,
    boardId: 3,
    boardUrl: "https://app.weeek.net/ws/12345/project/2/board/3",
  });
});

test("returns only the configured env-file token without mutating process.env", async () => {
  const fixture = await createFixture(
    {
      version: 1,
      boardUrl: "https://app.weeek.net/ws/12345/project/2/board/3",
      auth: {
        source: "env-file",
        file: "apps/api/.env",
        variable: "WEEEK_API_TOKEN",
      },
    },
    [
      "WEEEK_API_TOKEN=weeek-secret",
      "DATABASE_URL=postgres://secret",
      "JWT_SECRET=jwt-secret",
      "SSH_PRIVATE_KEY=ssh-secret",
      "",
    ].join("\n")
  );
  const original = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    SSH_PRIVATE_KEY: process.env.SSH_PRIVATE_KEY,
  };
  delete process.env.DATABASE_URL;
  delete process.env.JWT_SECRET;
  delete process.env.SSH_PRIVATE_KEY;

  try {
    const loaded = await loadProjectConfig(fixture.configPath);
    assert.equal(await resolveToken(loaded, {}), "weeek-secret");
    assert.equal(process.env.DATABASE_URL, undefined);
    assert.equal(process.env.JWT_SECRET, undefined);
    assert.equal(process.env.SSH_PRIVATE_KEY, undefined);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("loads optional intake field definitions from the project config", async () => {
  const fixture = await createFixture({
    version: 1,
    boardUrl: "https://app.weeek.net/ws/1/project/2/board/3",
    auth: { source: "env", variable: "WEEEK_API_TOKEN" },
    intakeFields: [
      { name: "URL", type: "text" },
      { name: "Раздел", type: "select", options: ["Объекты", "Карта"] },
    ],
  });

  const loaded = await loadProjectConfig(fixture.configPath);

  assert.deepEqual(loaded.config.intakeFields, [
    { name: "URL", type: "text" },
    { name: "Раздел", type: "select", options: ["Объекты", "Карта"] },
  ]);
});

test("rejects a select intake field without options", async () => {
  const fixture = await createFixture({
    version: 1,
    boardUrl: "https://app.weeek.net/ws/1/project/2/board/3",
    auth: { source: "env", variable: "WEEEK_API_TOKEN" },
    intakeFields: [{ name: "Раздел", type: "select", options: [] }],
  });

  await assert.rejects(() => loadProjectConfig(fixture.configPath), {
    code: "CONFIG_INVALID",
  });
});

// init-board собирает существующие поля один раз до создания новых, поэтому
// повтор в конфиге превратился бы во второе поле или второй вариант на доске.
// Имена сравниваются так же, как на доске: без регистра и лишних пробелов.
async function rejectsIntakeFields(intakeFields: unknown[], message: RegExp) {
  const fixture = await createFixture({
    version: 1,
    boardUrl: "https://app.weeek.net/ws/1/project/2/board/3",
    auth: { source: "env", variable: "WEEEK_API_TOKEN" },
    intakeFields,
  });
  await assert.rejects(
    () => loadProjectConfig(fixture.configPath),
    (error: { code?: string; message?: string }) => {
      assert.equal(error.code, "CONFIG_INVALID");
      assert.match(error.message ?? "", message);
      return true;
    }
  );
}

test("rejects intake fields whose names repeat up to case and spacing", async () => {
  await rejectsIntakeFields(
    [
      { name: "Раздел", type: "text" },
      { name: "  раздел ", type: "select", options: ["Карта"] },
    ],
    /intakeFields\.1\.name: .*intakeFields\[0\]/
  );
});

test("rejects select options that repeat up to case and spacing", async () => {
  await rejectsIntakeFields(
    [{ name: "Локация", type: "select", options: ["Москва", "Казань", "москва"] }],
    /intakeFields\.0\.options\.2: .*options\[0\]/
  );
});

test("rejects intake fields that reuse the AI workflow field names", async () => {
  await rejectsIntakeFields(
    [{ name: "ии-отчёт", type: "text" }],
    /intakeFields\.0\.name: .*reserved/
  );
});

test("returns stable codes for invalid config and missing token", async () => {
  const invalid = await createFixture({ version: 2, boardUrl: "bad", auth: {} });
  await assert.rejects(() => loadProjectConfig(invalid.configPath), {
    code: "CONFIG_INVALID",
  });

  const missing = await createFixture({
    version: 1,
    boardUrl: "https://app.weeek.net/ws/1/project/2/board/3",
    auth: { source: "env", variable: "WEEEK_API_TOKEN" },
  });
  const loaded = await loadProjectConfig(missing.configPath);
  await assert.rejects(() => resolveToken(loaded, {}), {
    code: "TOKEN_NOT_FOUND",
  });
});
