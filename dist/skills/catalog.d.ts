import type { ClientName } from "../clients/types.js";
export declare const SKILL_NAMES: readonly ["weeek-init", "weeek-errors", "weeek-tasks", "weeek-any", "weeek-rework", "weeek-changelog-update", "weeek-release", "weeek-setup-changelog"];
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
/** claude-desktop не читает проектные скиллы, поэтому профиля у него нет. */
export declare function skillProfile(client: ClientName): SkillClientProfile | undefined;
export declare function skillTemplatesDir(): string;
export declare function skillTemplatePath(skill: SkillName): string;
export declare function skillFilePath(projectRoot: string, profile: SkillClientProfile, skill: SkillName): string;
export declare function renderSkill(template: string, profile: SkillClientProfile): string;
export declare function readSkillTemplate(skill: SkillName): Promise<string>;
