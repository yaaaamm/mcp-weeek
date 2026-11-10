import assert from "node:assert/strict";
import test from "node:test";
import { SERVER_VERSION } from "../version.js";
import { applyMarker, ownershipOf, readMarker, stripMarker } from "./marker.js";

const RENDERED = `---
name: weeek-any
description: Take the next task.
---

Шаги:

1. Сделай хорошо.
`;

test("marker lands inside frontmatter and round-trips back to the clean text", () => {
  const marked = applyMarker(RENDERED);
  assert.match(marked, /^---\n/);
  assert.match(marked, new RegExp(`^x-mcp-weeek: ${SERVER_VERSION} [0-9a-f]{16}$`, "m"));
  // Пометка обязана стоять во фронтматтере, иначе её увидит человек в теле скилла.
  const frontmatter = marked.slice(0, marked.indexOf("\n---\n", 4));
  assert.match(frontmatter, /x-mcp-weeek:/);
  assert.equal(stripMarker(marked), RENDERED);
  assert.equal(readMarker(marked)?.version, SERVER_VERSION);
});

test("re-marking is idempotent and never stacks markers", () => {
  const once = applyMarker(RENDERED);
  const twice = applyMarker(once);
  assert.equal(twice, once);
  assert.equal(twice.match(/x-mcp-weeek:/g)?.length, 1);
});

test("marker records the version that wrote the file", () => {
  const old = applyMarker(RENDERED, "1.7.0");
  assert.deepEqual(readMarker(old)?.version, "1.7.0");
  assert.equal(ownershipOf(old), "managed");
});

test("ownership separates untouched files from hand-edited and hand-copied ones", () => {
  assert.equal(ownershipOf(""), "absent");
  assert.equal(ownershipOf(applyMarker(RENDERED)), "managed");
  assert.equal(ownershipOf(RENDERED), "foreign");

  const edited = applyMarker(RENDERED).replace("Сделай хорошо.", "Сделай по-своему.");
  assert.equal(ownershipOf(edited), "modified");

  const editedFrontmatter = applyMarker(RENDERED).replace(
    "description: Take the next task.",
    "description: Мой вариант."
  );
  assert.equal(ownershipOf(editedFrontmatter), "modified");
});

test("a file whose marker was deleted reads as hand-copied, not as managed", () => {
  const marked = applyMarker(RENDERED);
  assert.equal(ownershipOf(stripMarker(marked)), "foreign");
});

test("templates without frontmatter are rejected rather than silently unmarked", () => {
  assert.throws(() => applyMarker("no frontmatter here\n"), /frontmatter/);
});
