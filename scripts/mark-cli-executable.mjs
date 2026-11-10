import { chmod } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cliPath = path.join(repositoryRoot, "dist", "cli.js");

if (
  path.dirname(cliPath) !== path.join(repositoryRoot, "dist") ||
  path.basename(cliPath) !== "cli.js"
) {
  throw new Error(`Refusing to change mode for unexpected path: ${cliPath}`);
}

if (process.platform !== "win32") {
  await chmod(cliPath, 0o755);
}
