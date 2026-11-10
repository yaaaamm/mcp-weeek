import { readFile } from "node:fs/promises";
import type { ClientChangeStatus, ClientName } from "../clients/types.js";
import {
  readSkillTemplate,
  renderSkill,
  skillFilePath,
  skillProfile,
  SKILL_NAMES,
  type SkillName,
} from "./catalog.js";
import { applyMarker, ownershipOf, readMarker, type SkillOwnership } from "./marker.js";

export type SkillChange = {
  client: ClientName;
  skill: SkillName;
  path: string;
  before: string;
  after: string;
  status: ClientChangeStatus;
  /** Кто владеет файлом на диске — решает, можно ли переписать его молча. */
  ownership: SkillOwnership;
  /** Версия пакета, положившего файл; null у скопированных руками. */
  installedVersion: string | null;
};

export type PlanSkillChangesOptions = {
  clients: readonly ClientName[];
  projectRoot: string;
};

async function readOptional(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

export async function planSkillChanges(
  options: PlanSkillChangesOptions
): Promise<SkillChange[]> {
  const changes: SkillChange[] = [];
  const templates = new Map<SkillName, string>();
  for (const client of options.clients) {
    const profile = skillProfile(client);
    if (!profile) continue;
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
export function needsConfirmation(change: SkillChange): boolean {
  if (change.status === "unchanged") return false;
  return change.ownership === "modified" || change.ownership === "foreign";
}
