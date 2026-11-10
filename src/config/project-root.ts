import { access } from "node:fs/promises";
import path from "node:path";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findProjectRoot(startDirectory: string): Promise<string> {
  let current = path.resolve(startDirectory);
  let packageRoot: string | undefined;
  while (true) {
    if (await exists(path.join(current, ".git"))) return current;
    if (!packageRoot && (await exists(path.join(current, "package.json")))) {
      packageRoot = current;
    }
    const parent = path.dirname(current);
    if (parent === current) return packageRoot ?? path.resolve(startDirectory);
    current = parent;
  }
}
