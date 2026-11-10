import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const SKILL_NAMES = [
    "weeek-init",
    "weeek-errors",
    "weeek-tasks",
    "weeek-any",
    "weeek-rework",
    "weeek-changelog-update",
    "weeek-release",
    "weeek-setup-changelog",
];
const SKILL_CLIENTS = {
    "claude-code": {
        directorySegments: [".claude", "skills"],
        agentDoc: "CLAUDE.md",
        rulesDir: ".claude/rules/",
    },
    codex: {
        directorySegments: [".codex", "skills"],
        agentDoc: "AGENTS.md",
        rulesDir: ".codex/rules/",
    },
    antigravity: {
        directorySegments: [".agents", "skills"],
        agentDoc: "AGENTS.md",
        rulesDir: ".agents/rules/",
    },
};
/** claude-desktop не читает проектные скиллы, поэтому профиля у него нет. */
export function skillProfile(client) {
    return SKILL_CLIENTS[client];
}
export function skillTemplatesDir() {
    return path.join(path.dirname(fileURLToPath(import.meta.url)), "templates");
}
export function skillTemplatePath(skill) {
    return path.join(skillTemplatesDir(), skill, "SKILL.md");
}
export function skillFilePath(projectRoot, profile, skill) {
    return path.join(projectRoot, ...profile.directorySegments, skill, "SKILL.md");
}
export function renderSkill(template, profile) {
    return template
        .replaceAll("{{AGENT_DOC}}", profile.agentDoc)
        .replaceAll("{{RULES_DIR}}", profile.rulesDir);
}
export async function readSkillTemplate(skill) {
    return readFile(skillTemplatePath(skill), "utf8");
}
