import { randomUUID } from "node:crypto";
import { chmod, copyFile, mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
async function exists(filePath) {
    try {
        await stat(filePath);
        return true;
    }
    catch {
        return false;
    }
}
async function restore(applied) {
    for (const item of [...applied].reverse()) {
        if (item.change.before === "") {
            await unlink(item.change.path).catch(() => undefined);
        }
        else if (item.backupPath) {
            await copyFile(item.backupPath, item.change.path).catch(() => undefined);
        }
        else {
            await writeFile(item.change.path, item.change.before, "utf8").catch(() => undefined);
        }
    }
}
export async function writeAtomicText(filePath, text, defaultMode = 0o600) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const mode = (await stat(filePath).catch(() => undefined))?.mode ?? defaultMode;
    const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
    try {
        await writeFile(temporaryPath, text, { encoding: "utf8", mode });
        await chmod(temporaryPath, mode);
        await rename(temporaryPath, filePath);
    }
    catch (error) {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
    }
}
export async function applyClientChanges(changes) {
    const applied = [];
    try {
        for (const change of changes) {
            if (change.status === "unchanged")
                continue;
            await mkdir(path.dirname(change.path), { recursive: true });
            let backupPath;
            if (change.backup && change.before !== "" && (await exists(change.path))) {
                backupPath = `${change.path}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
                await copyFile(change.path, backupPath);
            }
            await writeAtomicText(change.path, change.after);
            applied.push({ change, backupPath });
        }
        return applied;
    }
    catch (error) {
        await restore(applied);
        throw error;
    }
}
