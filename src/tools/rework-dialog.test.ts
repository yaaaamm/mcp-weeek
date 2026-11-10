import assert from "node:assert/strict";
import test from "node:test";
import { AI_DIALOG_FIELD_NAME } from "../constants.js";
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

test("rework queue returns only incomplete AI_REWORK tasks with resolved fields", async () => {
  const requestedTaskColumns: number[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    const request = new Request(input);
    const url = new URL(request.url);
    if (url.pathname.endsWith("/tm/board-columns")) {
      return jsonResponse({
        success: true,
        boardColumns: [
          { id: 40, boardId: 30, name: "Доработать ИИ" },
          { id: 50, boardId: 30, name: "ИИ в работе" },
          { id: 60, boardId: 30, name: "Ожидает релиза" },
        ],
      });
    }
    if (url.pathname.endsWith("/tm/tasks")) {
      const boardColumnId = Number(url.searchParams.get("boardColumnId"));
      requestedTaskColumns.push(boardColumnId);
      return jsonResponse({
        success: true,
        tasks:
          boardColumnId === 40
            ? [
                {
                  id: 501,
                  title: "Исправить округление",
                  boardColumnId: 40,
                  priority: 2,
                  isCompleted: false,
                  customFields: [
                    {
                      id: "ai-dialog",
                      name: "ИИ-диалог",
                      type: "text",
                      value: "Ответ человека",
                    },
                    {
                      id: "section",
                      name: "Раздел",
                      type: "select",
                      value: "billing",
                      options: [{ id: "billing", name: "Оплата" }],
                    },
                  ],
                },
                {
                  id: 502,
                  title: "Уже завершена",
                  boardColumnId: 40,
                  priority: null,
                  isCompleted: true,
                  customFields: [],
                },
              ]
            : [],
      });
    }
    return jsonResponse({ success: true });
  };
  const context = createServerContext(loaded(), "weeek-secret", fakeFetch);
  const { listReworkTasks } = await import("./list-rework-tasks.js");

  const result = await listReworkTasks(context, 30);

  assert.deepEqual(requestedTaskColumns, [40]);
  assert.equal(result.totalRework, 1);
  assert.equal(result.role, "AI_REWORK");
  assert.deepEqual(result.tasks.map((task) => task.id), [501]);
  assert.equal(result.tasks[0].fields["ИИ-диалог"], "Ответ человека");
  assert.equal(result.tasks[0].fields["Раздел"], "Оплата");
  assert.match(result.nextSteps.read, /weeek_get_task/);
  assert.match(result.nextSteps.claim, /AI_IN_PROGRESS/);
  const finish = (result.nextSteps as Record<string, string>).finish;
  assert.match(finish, /weeek_finish_task/);
  assert.match(finish, /report/);
});

type DialogFieldFixture = {
  id: string;
  name: string;
  type: string;
  value: unknown;
};

function dialogRuntime(options: {
  field?: DialogFieldFixture;
  includeDiscuss?: boolean;
}): {
  context: ReturnType<typeof createServerContext>;
  putBodies: Array<Record<string, unknown>>;
} {
  const putBodies: Array<Record<string, unknown>> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/public/v1/tm/tasks/501") {
      return jsonResponse({
        success: true,
        task: {
          id: 501,
          title: "Уточнить округление",
          boardColumnId: 10,
          priority: 2,
          customFields: options.field ? [options.field] : [],
        },
      });
    }
    if (request.method === "GET" && url.pathname.endsWith("/tm/tasks")) {
      return jsonResponse({
        success: true,
        tasks: [
          {
            id: 501,
            customFields: options.field ? [options.field] : [],
          },
        ],
      });
    }
    if (request.method === "GET" && url.pathname.endsWith("/tm/board-columns")) {
      return jsonResponse({
        success: true,
        boardColumns:
          options.includeDiscuss === false
            ? []
            : [{ id: 70, boardId: 30, name: "Обсудить" }],
      });
    }
    if (request.method === "PUT" && url.pathname.endsWith("/tm/tasks/501")) {
      const body = JSON.parse(await request.text()) as Record<string, unknown>;
      putBodies.push(body);
      return jsonResponse({ success: true, task: { id: 501 } });
    }
    return jsonResponse({ success: true });
  };
  return {
    context: createServerContext(loaded(), "weeek-secret", fakeFetch),
    putBodies,
  };
}

test("ask question preserves dialog history and moves to DISCUSS in one update", async () => {
  const runtime = dialogRuntime({
    field: {
      id: "ai-dialog",
      name: AI_DIALOG_FIELD_NAME,
      type: "text",
      value: "[Человек]\nПроверьте округление.",
    },
  });
  const { askQuestion } = await import("./ask-question.js");

  const result = await askQuestion(
    runtime.context,
    {
      taskId: 501,
      boardId: 30,
      question: "Что считать правильным результатом?",
    },
    () => new Date("2026-08-12T10:30:00.000Z")
  );

  assert.equal(runtime.putBodies.length, 1);
  assert.deepEqual(runtime.putBodies[0], {
    customFields: {
      "ai-dialog":
        "[Человек]\nПроверьте округление.\n\n" +
        "[ИИ · 2026-08-12T10:30:00.000Z]\n" +
        "Вопрос: Что считать правильным результатом?",
    },
    boardColumnId: 70,
  });
  assert.equal(result.taskId, 501);
  assert.equal(result.destinationRole, "DISCUSS");
  assert.equal(result.destinationName, "Обсудить");
  assert.equal(
    result.appendedEntry,
    "[ИИ · 2026-08-12T10:30:00.000Z]\n" +
      "Вопрос: Что считать правильным результатом?"
  );
});

test("ask question starts dialog history when the field is empty", async () => {
  const runtime = dialogRuntime({
    field: {
      id: "ai-dialog",
      name: AI_DIALOG_FIELD_NAME,
      type: "text",
      value: null,
    },
  });
  const { askQuestion } = await import("./ask-question.js");

  await askQuestion(
    runtime.context,
    { taskId: 501, boardId: 30, question: "  Нужен пример?  " },
    () => new Date("2026-08-12T11:00:00.000Z")
  );

  assert.deepEqual(runtime.putBodies[0], {
    customFields: {
      "ai-dialog": "[ИИ · 2026-08-12T11:00:00.000Z]\nВопрос: Нужен пример?",
    },
    boardColumnId: 70,
  });
});

test("ask question rejects invalid schema preconditions before any update", async () => {
  const { askQuestion } = await import("./ask-question.js");
  const cases = [
    {
      name: "empty question",
      runtime: dialogRuntime({
        field: {
          id: "ai-dialog",
          name: AI_DIALOG_FIELD_NAME,
          type: "text",
          value: null,
        },
      }),
      question: "   ",
      expectedCode: "CONFIG_INVALID",
    },
    {
      name: "missing dialog field",
      runtime: dialogRuntime({}),
      question: "Нужны детали",
      expectedCode: "BOARD_SCHEMA_INCOMPLETE",
    },
    {
      name: "non-text dialog field",
      runtime: dialogRuntime({
        field: {
          id: "ai-dialog",
          name: AI_DIALOG_FIELD_NAME,
          type: "select",
          value: null,
        },
      }),
      question: "Нужны детали",
      expectedCode: "BOARD_SCHEMA_INCOMPLETE",
    },
    {
      name: "missing discussion column",
      runtime: dialogRuntime({
        field: {
          id: "ai-dialog",
          name: AI_DIALOG_FIELD_NAME,
          type: "text",
          value: null,
        },
        includeDiscuss: false,
      }),
      question: "Нужны детали",
      expectedCode: "BOARD_SCHEMA_INCOMPLETE",
    },
  ];

  for (const fixture of cases) {
    await assert.rejects(
      () =>
        askQuestion(fixture.runtime.context, {
          taskId: 501,
          boardId: 30,
          question: fixture.question,
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
