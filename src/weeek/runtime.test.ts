import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_DIALOG_FIELD_NAME,
  REQUIRED_CUSTOM_FIELD_NAMES,
  REQUIRED_ROLES,
  ROLE_COLUMN_NAMES,
} from "../constants.js";
import type { LoadedProjectConfig } from "../config/load.js";
import type { IntakeField } from "../config/schema.js";
import { createServerContext } from "../server-context.js";
import { createWeeekClient } from "../weeek-client.js";
import { ensureBoard } from "./init-board.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function loaded(boardId: number, intakeFields?: IntakeField[]): LoadedProjectConfig {
  return {
    path: "/project/.weeek-mcp.json",
    rootDir: "/project",
    config: {
      version: 1,
      boardUrl: `https://app.weeek.net/ws/10/project/20/board/${boardId}`,
      auth: { source: "env", variable: "WEEEK_API_TOKEN" },
      ...(intakeFields ? { intakeFields } : {}),
    },
    binding: {
      workspaceId: 10,
      projectId: 20,
      boardId,
      boardUrl: `https://app.weeek.net/ws/10/project/20/board/${boardId}`,
    },
  };
}

test("Weeek client sends only its injected token and query", async () => {
  let recorded: Request | undefined;
  const fakeFetch: typeof fetch = async (input, init) => {
    recorded = new Request(input, init);
    return jsonResponse({ success: true, boards: [] });
  };
  const client = createWeeekClient({ token: "weeek-secret", fetch: fakeFetch });

  await client.get("/tm/boards", { projectId: 2 });

  assert.ok(recorded);
  assert.equal(recorded.headers.get("Authorization"), "Bearer weeek-secret");
  assert.equal(new URL(recorded.url).searchParams.get("projectId"), "2");
  assert.equal(recorded.headers.has("DATABASE_URL"), false);
});

test("server contexts do not share tokens or board caches", async () => {
  const authorizations: string[] = [];
  const fetchFor = (columnId: number): typeof fetch => async (input, init) => {
    const request = new Request(input, init);
    authorizations.push(request.headers.get("Authorization") ?? "");
    return jsonResponse({
      success: true,
      boardColumns: [{ id: columnId, name: "Ошибки", boardId: columnId }],
    });
  };
  const first = createServerContext(loaded(31), "first-token", fetchFor(101));
  const second = createServerContext(loaded(31), "second-token", fetchFor(202));

  assert.equal(await first.boardSchema.resolveRoleColumnId(31, "SOURCE_ERRORS"), 101);
  assert.equal(await second.boardSchema.resolveRoleColumnId(31, "SOURCE_ERRORS"), 202);
  assert.deepEqual(authorizations, ["Bearer first-token", "Bearer second-token"]);
  assert.equal(first.boardId, 31);
  assert.equal(second.boardId, 31);
});

test("board schema resolves the rework role and required dialog text field by name", async () => {
  const fakeFetch: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname.endsWith("/tm/board-columns")) {
      return jsonResponse({
        success: true,
        boardColumns: [{ id: 71, name: "  ДОРАБОТАТЬ   ии ", boardId: 30 }],
      });
    }
    if (url.pathname.endsWith("/tm/tasks")) {
      return jsonResponse({
        success: true,
        tasks: [
          {
            id: 501,
            customFields: [
              { id: "ai-dialog", name: "  ИИ-ДИАЛОГ ", type: "text", value: null },
            ],
          },
        ],
      });
    }
    return jsonResponse({ success: true });
  };
  const context = createServerContext(loaded(30), "weeek-secret", fakeFetch);

  assert.equal(
    await context.boardSchema.resolveRoleColumnId(30, "AI_REWORK"),
    71
  );
  assert.equal(
    await context.boardSchema.resolveTextCustomFieldId(
      30,
      AI_DIALOG_FIELD_NAME,
      501
    ),
    "ai-dialog"
  );
});

test("text-field resolver rejects a non-text dialog field with a stable schema code", async () => {
  const fakeFetch: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname.endsWith("/tm/tasks")) {
      return jsonResponse({
        success: true,
        tasks: [
          {
            id: 501,
            customFields: [
              { id: "ai-dialog", name: AI_DIALOG_FIELD_NAME, type: "select", value: null },
            ],
          },
        ],
      });
    }
    return jsonResponse({ success: true, boardColumns: [] });
  };
  const context = createServerContext(loaded(30), "weeek-secret", fakeFetch);

  await assert.rejects(
    () =>
      context.boardSchema.resolveTextCustomFieldId(
        30,
        AI_DIALOG_FIELD_NAME,
        501
      ),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "BOARD_SCHEMA_INCOMPLETE"
  );
});

test("board initialization dry-run is repeatable and never writes", async () => {
  let posts = 0;
  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    if (request.method === "POST") {
      posts += 1;
      return jsonResponse({ success: true });
    }
    if (request.url.includes("/tm/board-columns")) {
      return jsonResponse({ success: true, boardColumns: [] });
    }
    if (request.url.includes("/tm/tasks")) {
      return jsonResponse({ success: true, tasks: [] });
    }
    return jsonResponse({ success: true });
  };
  const context = createServerContext(loaded(3), "weeek-secret", fakeFetch);

  const first = await ensureBoard(context, {
    boardId: 3,
    includeOptional: false,
    dryRun: true,
  });
  const second = await ensureBoard(context, {
    boardId: 3,
    includeOptional: false,
    dryRun: true,
  });

  // Считаем от самой схемы, а не от литерала: иначе добавленная роль тихо
  // разъедется с тестом вместо того, чтобы его уронить. На доске без задач
  // поля не создаются (API показывает их только через задачи), поэтому в
  // план попадают одни колонки.
  assert.equal(first.fieldsVisible, false);
  assert.equal(first.createdCount, REQUIRED_ROLES.length);
  assert.deepEqual(
    first.customFields.map((field) => field.status),
    REQUIRED_CUSTOM_FIELD_NAMES.map(() => "skipped")
  );
  assert.deepEqual(
    first.columns.map((column) => column.name),
    REQUIRED_ROLES.map((role) => ROLE_COLUMN_NAMES[role]),
    "init без --include-optional обязан покрывать все колонки, куда пишут weeek_*"
  );
  assert.equal(
    first.columns.some((column) => column.name === ROLE_COLUMN_NAMES.REJECT_CONFIRM),
    true,
    "цель weeek_reject_task не должна требовать --include-optional"
  );
  assert.deepEqual(
    first.customFields.map((field) => field.name),
    ["ИИ-отчёт", "ИИ-диалог"]
  );
  assert.deepEqual(second, first);
  assert.equal(posts, 0);
});

// Цвета варианта из enum Weeek API (CustomFieldOption.color) — всё остальное API отвергнет.
const OPTION_COLORS = [
  "blue",
  "light_blue",
  "dark_purple",
  "purple",
  "dark_pink",
  "pink",
  "light_pink",
  "red",
];

type RecordedPost = { path: string; body: Record<string, unknown> };

// Доска, где workflow уже инициализирован: есть все обязательные колонки и
// ИИ-поля, а intake-поля задаются тестом.
function initializedBoardFetch(
  intakeFieldsOnBoard: unknown[],
  posts: RecordedPost[]
): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);
    if (request.method === "POST") {
      const body = (await request.json()) as Record<string, unknown>;
      posts.push({ path: pathname, body });
      if (pathname.endsWith("/options")) {
        return jsonResponse({
          success: true,
          option: { id: `opt-${String(body.name)}`, name: body.name, color: body.color },
        });
      }
      return jsonResponse({
        success: true,
        customField: { id: `field-${String(body.name)}`, name: body.name, type: body.type },
      });
    }
    if (pathname.endsWith("/tm/board-columns")) {
      return jsonResponse({
        success: true,
        boardColumns: REQUIRED_ROLES.map((role, index) => ({
          id: 900 + index,
          name: ROLE_COLUMN_NAMES[role],
          boardId: 3,
        })),
      });
    }
    if (pathname.endsWith("/tm/tasks")) {
      return jsonResponse({
        success: true,
        tasks: [
          {
            id: 501,
            customFields: [
              { id: "ai-report", name: "ИИ-отчёт", type: "text", value: null },
              { id: "ai-dialog", name: "ИИ-диалог", type: "text", value: null },
              ...intakeFieldsOnBoard,
            ],
          },
        ],
      });
    }
    return jsonResponse({ success: true });
  };
}

test("board initialization adds missing intake fields and only the missing select options", async () => {
  const posts: RecordedPost[] = [];
  const context = createServerContext(
    loaded(3, [
      { name: "URL", type: "text" },
      { name: "Раздел", type: "select", options: ["Объекты", "Карта"] },
      { name: "Локация", type: "select", options: ["Шапка"] },
    ]),
    "weeek-secret",
    initializedBoardFetch(
      [
        {
          id: "section",
          name: " раздел ",
          type: "select",
          value: null,
          options: [{ id: "opt-objects", name: "  объекты ", color: "blue" }],
        },
      ],
      posts
    )
  );

  const preview = await ensureBoard(context, { boardId: 3, dryRun: true });
  assert.equal(preview.createdCount, 4);
  assert.equal(posts.length, 0, "dry-run не пишет");

  const report = await ensureBoard(context, { boardId: 3 });

  assert.deepEqual(
    posts.map(({ path, body }) => ({ path, name: body.name, type: body.type })),
    [
      { path: "/public/v1/tm/boards/3/custom-fields", name: "URL", type: "text" },
      {
        path: "/public/v1/tm/boards/3/custom-fields/section/options",
        name: "Карта",
        type: undefined,
      },
      { path: "/public/v1/tm/boards/3/custom-fields", name: "Локация", type: "select" },
      {
        path: "/public/v1/tm/boards/3/custom-fields/field-Локация/options",
        name: "Шапка",
        type: undefined,
      },
    ]
  );
  for (const post of posts.filter(({ path }) => path.endsWith("/options"))) {
    assert.ok(
      OPTION_COLORS.includes(String(post.body.color)),
      `цвет ${String(post.body.color)} не из enum Weeek`
    );
  }
  assert.equal(report.createdCount, 4);
  assert.deepEqual(
    report.intakeFields.find((field) => field.name === "Раздел")?.options,
    [
      { name: "Объекты", status: "existing", id: "opt-objects" },
      { name: "Карта", status: "created", id: "opt-Карта" },
    ]
  );
});

test("an intake field that exists with another type is reported as a conflict and never rewritten", async () => {
  const posts: RecordedPost[] = [];
  const context = createServerContext(
    loaded(3, [{ name: "URL", type: "text" }]),
    "weeek-secret",
    initializedBoardFetch(
      [{ id: "url-select", name: "URL", type: "select", value: null, options: [] }],
      posts
    )
  );

  const report = await ensureBoard(context, { boardId: 3 });

  assert.deepEqual(report.intakeFields, [
    { name: "URL", type: "text", status: "conflict", id: "url-select" },
  ]);
  assert.equal(report.createdCount, 0);
  assert.equal(posts.length, 0);
});

// У API Weeek нет чтения полей доски — они видны только в задачах. На доске без
// задач пустой список полей значит «неизвестно», и создание плодило бы дубли
// при каждом повторном запуске, в том числе «ИИ-отчёта».
test("a board without tasks gets its columns but no custom fields at all", async () => {
  const posts: string[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    if (request.method === "POST") {
      posts.push(pathname);
      return jsonResponse({ success: true, boardColumn: { id: 700 } });
    }
    if (pathname.endsWith("/tm/board-columns")) {
      return jsonResponse({ success: true, boardColumns: [] });
    }
    if (pathname.endsWith("/tm/tasks")) {
      return jsonResponse({ success: true, tasks: [] });
    }
    return jsonResponse({ success: true });
  };
  const context = createServerContext(
    loaded(3, [
      { name: "URL", type: "text" },
      { name: "Раздел", type: "select", options: ["Карта"] },
    ]),
    "weeek-secret",
    fakeFetch
  );

  const report = await ensureBoard(context, { boardId: 3 });

  assert.equal(report.fieldsVisible, false);
  assert.ok(
    posts.length === REQUIRED_ROLES.length &&
      posts.every((path) => path.endsWith("/tm/board-columns")),
    `создаются только колонки, а запросы были: ${posts.join(", ")}`
  );
  assert.equal(report.createdCount, REQUIRED_ROLES.length);
  assert.deepEqual(
    report.customFields.map((field) => field.status),
    REQUIRED_CUSTOM_FIELD_NAMES.map(() => "skipped")
  );
  assert.deepEqual(
    report.intakeFields.map((field) => [field.name, field.status]),
    [
      ["URL", "skipped"],
      ["Раздел", "skipped"],
    ]
  );
  assert.ok(report.intakeFields.every((field) => field.options === undefined));
});
