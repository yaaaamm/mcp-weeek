import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ClientName } from "../clients/types.js";

export const SKILL_NAMES = [
  "weeek-init",
  "weeek-errors",
  "weeek-tasks",
  "weeek-any",
  "weeek-rework",
  "weeek-changelog-update",
  "weeek-release",
  "weeek-setup-changelog",
] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

/**
 * Каждый клиент читает скиллы из своей папки и ссылается на свой файл правил,
 * поэтому один шаблон рендерится под клиента через плейсхолдеры.
 */
export type SkillClientProfile = {
  directorySegments: readonly string[];
  agentDoc: string;
  rulesDir: string;
};

const SKILL_CLIENTS: Partial<Record<ClientName, SkillClientProfile>> = {
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
export function skillProfile(client: ClientName): SkillClientProfile | undefined {
  return SKILL_CLIENTS[client];
}

export function skillTemplatesDir(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "templates");
}

export function skillTemplatePath(skill: SkillName): string {
  return path.join(skillTemplatesDir(), skill, "SKILL.md");
}

export function skillFilePath(
  projectRoot: string,
  profile: SkillClientProfile,
  skill: SkillName
): string {
  return path.join(projectRoot, ...profile.directorySegments, skill, "SKILL.md");
}

export function renderSkill(template: string, profile: SkillClientProfile): string {
  return template
    .replaceAll("{{AGENT_DOC}}", profile.agentDoc)
    .replaceAll("{{RULES_DIR}}", profile.rulesDir);
}

export async function readSkillTemplate(skill: SkillName): Promise<string> {
  return readFile(skillTemplatePath(skill), "utf8");
}
