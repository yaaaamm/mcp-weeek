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

function finishRuntime(options: {
  includeReportField?: boolean;
  includeReleaseColumn?: boolean;
} = {}): {
  context: ReturnType<typeof createServerContext>;
  putBodies: Array<Record<string, unknown>>;
} {
  const putBodies: Array<Record<string, unknown>> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname.endsWith("/tm/tasks")) {
      return jsonResponse({
        success: true,
        tasks:
          options.includeReportField === false
            ? []
            : [
                {
                  id: 501,
                  customFields: [
                    { id: "ai-report", name: "ИИ-отчёт", type: "text" },
                  ],
                },
              ],
      });
    }
    if (request.method === "GET" && url.pathname === "/public/v1/tm/tasks/501") {
      return jsonResponse({ success: true, task: { id: 501, customFields: [] } });
    }
    if (
      request.method === "GET" &&
      url.pathname.endsWith("/tm/board-columns")
    ) {
      return jsonResponse({
        success: true,
        boardColumns:
          options.includeReleaseColumn === false
            ? []
            : [{ id: 60, boardId: 30, name: "Ожидает релиза" }],
      });
    }
    if (request.method === "PUT" && url.pathname.endsWith("/tm/tasks/501")) {
      putBodies.push(JSON.parse(await request.text()) as Record<string, unknown>);
      return jsonResponse({ success: true, task: { id: 501 } });
    }
    throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
  };
  return {
    context: createServerContext(loaded(), "weeek-secret", fakeFetch),
    putBodies,
  };
}

async function loadFinishTask() {
  try {
    return (await import("./finish-task.js")).finishTask;
  } catch {
    assert.fail("finishTask must be implemented");
  }
}

test("finish task writes the report and AWAITING_RELEASE column in one update", async () => {
  const runtime = finishRuntime();
  const finishTask = await loadFinishTask();

  const result = await finishTask(runtime.context, {
    taskId: 501,
    boardId: 30,
    report: "  Исправлено и проверено.  ",
  });

  assert.deepEqual(runtime.putBodies, [
    {
      customFields: { "ai-report": "Исправлено и проверено." },
      boardColumnId: 60,
    },
  ]);
  assert.deepEqual(result, {
    taskId: 501,
    destinationRole: "AWAITING_RELEASE",
    destinationName: "Ожидает релиза",
    boardColumnId: 60,
    reportUpdated: true,
  });
});

test("finish task rejects invalid preconditions before any update", async () => {
  const finishTask = await loadFinishTask();
  const cases = [
    {
      name: "blank report",
      runtime: finishRuntime(),
      report: "   ",
      expectedCode: "CONFIG_INVALID",
    },
    {
      name: "missing report field",
      runtime: finishRuntime({ includeReportField: false }),
      report: "Проверено",
      expectedCode: "BOARD_SCHEMA_INCOMPLETE",
    },
    {
      name: "missing release column",
      runtime: finishRuntime({ includeReleaseColumn: false }),
      report: "Проверено",
      expectedCode: "BOARD_SCHEMA_INCOMPLETE",
    },
  ];

  for (const fixture of cases) {
    await assert.rejects(
      () =>
        finishTask(fixture.runtime.context, {
          taskId: 501,
          boardId: 30,
          report: fixture.report,
        }),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === fixture.expectedCode,
      fixture.name
    );
    assert.equal(fixture.runtime.putBodies.length, 0, fixture.name);
  }
});
