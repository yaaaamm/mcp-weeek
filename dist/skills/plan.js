import { readFile } from "node:fs/promises";
import { readSkillTemplate, renderSkill, skillFilePath, skillProfile, SKILL_NAMES, } from "./catalog.js";
import { applyMarker, ownershipOf, readMarker } from "./marker.js";
async function readOptional(filePath) {
    try {
        return await readFile(filePath, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT")
            return "";
        throw error;
    }
}
export async function planSkillChanges(options) {
    const changes = [];
    const templates = new Map();
    for (const client of options.clients) {
        const profile = skillProfile(client);
        if (!profile)
            continue;
        for (const skill of SKILL_NAMES) {
            let template = templates.get(skill);
            if (template === undefined) {
                template = await readSkillTemplate(skill);
                templates.set(skill, template);
            }
            const filePath = skillFilePath(options.projectRoot, profile, skill);
            const before = await readOptional(filePath);
            const after = applyMarker(renderSkill(template, profile));
            changes.push({
                client,
                skill,
                path: filePath,
                before,
                after,
                status: before === "" ? "added" : before === after ? "unchanged" : "updated",
                ownership: ownershipOf(before),
                installedVersion: before === "" ? null : (readMarker(before)?.version ?? null),
            });
        }
    }
    return changes;
}
/**
 * Файлы, которые нельзя трогать без явного разрешения: их правили руками или
 * положили мимо инструмента. Всё остальное обновляется молча.
 */
export function needsConfirmation(change) {
    if (change.status === "unchanged")
        return false;
    return change.ownership === "modified" || change.ownership === "foreign";
}
