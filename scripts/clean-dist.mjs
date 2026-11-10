import { lstat, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distPath = path.join(repositoryRoot, "dist");

if (path.dirname(distPath) !== repositoryRoot || path.basename(distPath) !== "dist") {
  throw new Error(`Refusing to clean unexpected path: ${distPath}`);
}
const existing = await lstat(distPath).catch(() => undefined);
if (existing?.isSymbolicLink()) {
  throw new Error(`Refusing to clean symlinked dist directory: ${distPath}`);
}
await rm(distPath, { recursive: true, force: true });
