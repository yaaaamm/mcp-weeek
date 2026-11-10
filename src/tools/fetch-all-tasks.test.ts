import assert from "node:assert/strict";
import test from "node:test";
import { createWeeekClient } from "../weeek-client.js";
import { fetchAllTasks } from "./fetch-all-tasks.js";
import { compactAllTasks } from "./task-list-format.js";
import type { WeeekTask } from "./task-list-format.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function task(id: number): WeeekTask {
  return { id, title: `task ${id}`, boardColumnId: 534, priority: null };
}

/** Отдаёт `total` задач страницами по `pageSize`, как это делает /tm/tasks. */
function pagedFetch(total: number, pageSize: number, seen: URL[]): typeof fetch {
  return async (input) => {
    const url = new URL(new Request(input).url);
    seen.push(url);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const perPage = Number(url.searchParams.get("perPage") ?? pageSize);
    const slice = Array.from({ length: total }, (_, index) => task(index + 1)).slice(
      offset,
      offset + Math.min(perPage, pageSize)
    );
    return jsonResponse({
      success: true,
      tasks: slice,
      hasMore: offset + slice.length < total,
    });
  };
}

test("fetchAllTasks собирает все страницы, а не только первую", async () => {
  const seen: URL[] = [];
  const weeek = createWeeekClient({
    token: "t",
    fetch: pagedFetch(26, 20, seen),
  });

  const result = await fetchAllTasks(weeek, { boardId: 133, boardColumnId: 534 });

  assert.equal(result.tasks.length, 26, "потеряли задачи со второй страницы");
  assert.equal(result.truncated, false);
  assert.equal(result.pagesFetched, 2);
  assert.deepEqual(
    result.tasks.map((item) => item.id),
    Array.from({ length: 26 }, (_, index) => index + 1)
  );
  assert.equal(seen[0].searchParams.get("offset"), "0");
  assert.equal(seen[1].searchParams.get("offset"), "20", "offset должен расти на фактически полученное");
  assert.equal(seen[0].searchParams.get("boardColumnId"), "534", "фильтр колонки обязан долетать до API");
});

test("fetchAllTasks не зацикливается на пустой странице с hasMore:true", async () => {
  let calls = 0;
  const weeek = createWeeekClient({
    token: "t",
    fetch: async () => {
      calls += 1;
      return jsonResponse({ success: true, tasks: [], hasMore: true });
    },
  });

  const result = await fetchAllTasks(weeek, { boardId: 133 });

  assert.equal(calls, 1);
  assert.deepEqual(result.tasks, []);
});

test("compactAllTasks отдаёт locations у задачи с нескольких досок и сохраняет завершённые", () => {
  const multiBoard: WeeekTask = {
    id: 3210,
    title: "Добавить обязательно чтобы внести блок при внесении показа",
    // верхний boardColumnId — колонка ЧУЖОЙ доски 175
    boardColumnId: 624,
    priority: null,
    locations: [
      { projectId: 38, boardId: 175, boardColumnId: 624 },
      { projectId: 37, boardId: 133, boardColumnId: 534 },
    ],
  };
  const singleBoard: WeeekTask = { ...task(1), isCompleted: true };

  const [first, second] = compactAllTasks([multiBoard, singleBoard]);

  assert.deepEqual(first.locations, multiBoard.locations, "без locations задача выпадет из отбора по колонке");
  assert.equal(second.locations, undefined, "одиночную доску не раздуваем");
  assert.equal(second.isCompleted, true, "compactAllTasks не должен молча выбрасывать завершённые");
});
