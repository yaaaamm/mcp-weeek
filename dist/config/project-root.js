import { access } from "node:fs/promises";
import path from "node:path";
async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
export async function findProjectRoot(startDirectory) {
    let current = path.resolve(startDirectory);
    let packageRoot;
    while (true) {
        if (await exists(path.join(current, ".git")))
            return current;
        if (!packageRoot && (await exists(path.join(current, "package.json")))) {
            packageRoot = current;
        }
        const parent = path.dirname(current);
        if (parent === current)
            return packageRoot ?? path.resolve(startDirectory);
        current = parent;
    }
}
