import assert from "node:assert/strict";
import test from "node:test";
import type { LoadedProjectConfig } from "../config/load.js";
import { createServerContext } from "../server-context.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function loaded(): LoadedProjectConfig {
  return {
    path: "/project/.weeek-mcp.json",
    rootDir: "/project",
    config: {
      version: 1,
      boardUrl: "https://app.weeek.net/ws/10/project/20/board/30",
      auth: { source: "env", variable: "WEEEK_API_TOKEN" },
    },
    binding: {
      workspaceId: 10,
      projectId: 20,
      boardId: 30,
      boardUrl: "https://app.weeek.net/ws/10/project/20/board/30",
    },
  };
}

test("pending queue exposes one finish step for report and handoff", async () => {
  const fakeFetch: typeof fetch = async (input) => {
    const request = new Request(input);
    const url = new URL(request.url);
    if (url.pathname.endsWith("/tm/board-columns")) {
      return jsonResponse({
        success: true,
        boardColumns: [
          { id: 10, boardId: 30, name: "Ошибки" },
          { id: 20, boardId: 30, name: "Доработки" },
          { id: 50, boardId: 30, name: "ИИ в работе" },
          { id: 60, boardId: 30, name: "Ожидает релиза" },
        ],
      });
    }
    if (url.pathname.endsWith("/tm/tasks")) {
      return jsonResponse({ success: true, tasks: [] });
    }
    throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
  };
  const context = createServerContext(loaded(), "weeek-secret", fakeFetch);
  const module = await import("./list-pending-tasks.js");
  assert.ok(
    "listPendingTasks" in module,
    "listPendingTasks must expose the pending workflow result"
  );
  const listPendingTasks = module.listPendingTasks as (
    context: typeof context,
    boardId: number
  ) => Promise<{ nextSteps: Record<string, string> }>;

  const result = await listPendingTasks(context, 30);

  assert.deepEqual(Object.keys(result.nextSteps).sort(), ["claim", "finish", "read"]);
  assert.match(result.nextSteps.finish, /weeek_finish_task/);
  assert.match(result.nextSteps.finish, /report/);
});
