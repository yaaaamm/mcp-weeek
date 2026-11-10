import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { parseCliArgs } from "../cli/args.js";

test("parses serve command and value flags deterministically", () => {
  assert.deepEqual(
    parseCliArgs(["serve", "--config", "/tmp/project/.weeek-mcp.json"]),
    {
      command: "serve",
      flags: { config: "/tmp/project/.weeek-mcp.json" },
    }
  );
  assert.deepEqual(parseCliArgs(["--help"]), {
    command: "help",
    flags: {},
  });
});

test("installed CLI completes a real STDIO initialize and tools/list handshake", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mcp-weeek-serve-"));
  const configPath = path.join(root, ".weeek-mcp.json");
  const envPath = path.join(root, ".env");
  await writeFile(envPath, "WEEEK_API_TOKEN=handshake-secret\n", "utf8");
  await writeFile(
    configPath,
    JSON.stringify({
      version: 1,
      boardUrl: "https://app.weeek.net/ws/10/project/20/board/30",
      auth: {
        source: "env-file",
        file: ".env",
        variable: "WEEEK_API_TOKEN",
      },
    }),
    "utf8"
  );

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("dist/cli.js"), "serve", "--config", configPath],
    cwd: root,
    stderr: "pipe",
  });
  const client = new Client({ name: "mcp-weeek-test", version: "1.0.0" });

  try {
    await client.connect(transport);
    const instructionsPrefix = client.getInstructions()?.slice(0, 512) ?? "";
    assert.match(instructionsPrefix, /weeek_list_pending_tasks/);
    assert.match(instructionsPrefix, /weeek_list_rework_tasks/);
    assert.match(instructionsPrefix, /weeek_ask_question/);
    assert.match(instructionsPrefix, /weeek_finish_task/);
    assert.match(instructionsPrefix, /AWAITING_RELEASE/);
    const result = await client.listTools();
    const names = result.tools.map((tool) => tool.name);
    assert.ok(names.includes("weeek_list_pending_tasks"));
    assert.ok(names.includes("weeek_list_rework_tasks"));
    assert.ok(names.includes("weeek_ask_question"));
    assert.ok(names.includes("weeek_finish_task"));
    assert.ok(names.includes("weeek_init_board"));
  } finally {
    await client.close();
  }
});
