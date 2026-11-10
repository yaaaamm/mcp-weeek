import { cp, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(repositoryRoot, "src", "skills", "templates");
const destination = path.join(repositoryRoot, "dist", "skills", "templates");

const skills = await readdir(source, { withFileTypes: true });
const directories = skills.filter((entry) => entry.isDirectory());
if (directories.length === 0) {
  throw new Error(`No skill templates found in ${source}`);
}

await cp(source, destination, { recursive: true });
process.stdout.write(`Copied ${directories.length} skill templates to dist.\n`);
