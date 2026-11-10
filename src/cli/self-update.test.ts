import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import {
  refreshSelf,
  SELF_CHECK_ENV,
  SELF_INSTALL_ARGS,
  SELF_INSTALL_SOURCE,
} from "./self-update.js";

test("self-update is a plain global install, with no workarounds", () => {
  assert.deepEqual(SELF_INSTALL_ARGS, ["install", "--global", SELF_INSTALL_SOURCE]);
});

test("no script name triggers pacote's git dependency preparation", () => {
  // pacote запускает вложенный `npm install` внутри клона, если в scripts есть
  // любое из этих имён (`build` — только гейт, npm его не выполняет). Эта
  // подготовка наследует префикс родителя: повторная установка падает с
  // ENOTEMPTY, а пакет ставится симлинком на удаляемый клон. Поэтому сборка
  // называется `compile`, а dist коммитится.
  const scripts = createRequire(import.meta.url)("../../package.json").scripts as Record<
    string,
    string
  >;
  const triggers = ["postinstall", "build", "preinstall", "install", "prepack", "prepare"];
  assert.deepEqual(
    triggers.filter((name) => name in scripts),
    []
  );
  assert.ok(scripts.compile, "the build step must still exist under a safe name");
});

function harness(overrides: Partial<Parameters<typeof refreshSelf>[0]> = {}) {
  const output: string[] = [];
  const installs: number[] = [];
  const reexecs: number[] = [];
  const dependencies = {
    output: (line: string) => output.push(line),
    env: {} as NodeJS.ProcessEnv,
    install: async () => void installs.push(1),
    reexec: async () => {
      reexecs.push(1);
      return 0;
    },
    ...overrides,
  };
  return { output, installs, reexecs, dependencies };
}

test("refresh reinstalls the tool and reruns the command with the new build", async () => {
  const { output, installs, reexecs, dependencies } = harness();
  const exitCode = await refreshSelf(dependencies);

  assert.equal(installs.length, 1);
  assert.equal(reexecs.length, 1);
  assert.equal(exitCode, 0);
  assert.match(output.join("\n"), /Fetching the latest mcp-weeek/);
});

test("the exit code of the rerun becomes the exit code of the command", async () => {
  const { dependencies } = harness({ reexec: async () => 3 });
  assert.equal(await refreshSelf(dependencies), 3);
});

test("a failed reinstall falls back to the installed version instead of aborting", async () => {
  const { output, reexecs, dependencies } = harness({
    install: async () => {
      throw new Error("npm ERR! network timeout");
    },
  });
  assert.equal(await refreshSelf(dependencies), null);
  assert.equal(reexecs.length, 0);
  assert.match(output.join("\n"), /Self-update failed, continuing/);
});

test("the rerun does not update again, so updates cannot loop", async () => {
  const { installs, output, dependencies } = harness({
    env: { [SELF_CHECK_ENV]: "1" } as NodeJS.ProcessEnv,
    install: async () => {
      throw new Error("must not reinstall inside the rerun");
    },
  });
  assert.equal(await refreshSelf(dependencies), null);
  assert.equal(installs.length, 0);
  assert.deepEqual(output, []);
});
