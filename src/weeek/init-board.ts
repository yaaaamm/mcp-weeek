import { normalizeName, type CustomField } from "../board-schema.js";
import type { IntakeField } from "../config/schema.js";
import {
  AI_REPORT_FIELD_NAME,
  OPTION_COLORS,
  OPTIONAL_COLUMN_NAMES,
  REQUIRED_CUSTOM_FIELD_NAMES,
  REQUIRED_ROLES,
  ROLE_COLUMN_NAMES,
} from "../constants.js";
import type { ServerContext } from "../server-context.js";

// "skipped": the board has no tasks, so its fields cannot be seen and the field
// was left alone rather than risk creating a duplicate (see fieldsHiddenMessage).
export type BoardItemOutcome = {
  name: string;
  status: "created" | "existing" | "skipped";
  id?: number | string;
};

// "conflict": a field with this name exists but has another type. It is left
// untouched — retyping would drop the values authors already filled in.
export type IntakeFieldOutcome = {
  name: string;
  type: IntakeField["type"];
  status: "created" | "existing" | "conflict" | "skipped";
  id?: string;
  options?: BoardItemOutcome[];
};

export type BoardInitOptions = {
  boardId?: number;
  includeOptional?: boolean;
  dryRun?: boolean;
};

export type BoardInitReport = {
  boardId: number;
  dryRun: boolean;
  includeOptional: boolean;
  /** false when the board has no tasks: custom fields were then not touched. */
  fieldsVisible: boolean;
  createdCount: number;
  columns: BoardItemOutcome[];
  customFields: BoardItemOutcome[];
  customField: BoardItemOutcome;
  intakeFields: IntakeFieldOutcome[];
};

/**
 * The Weeek API has no endpoint that lists a board's custom fields; they are
 * visible only on its tasks. On a board without tasks there is no way to tell
 * which fields already exist, so init-board creates none there — otherwise
 * every rerun on that board would add another copy of each field.
 */
export function fieldsHiddenMessage(boardId: number): string {
  return (
    `Board ${boardId} has no tasks. The Weeek API shows a board's custom fields only ` +
    "through its tasks, so it cannot tell which fields already exist, and creating " +
    "them could duplicate existing ones. Custom fields were not created. " +
    "Create any task on the board and run init-board again."
  );
}

async function ensureIntakeField(
  context: ServerContext,
  boardId: number,
  wanted: IntakeField,
  hit: CustomField | undefined,
  dryRun: boolean
): Promise<IntakeFieldOutcome> {
  const { name, type } = wanted;
  if (hit && hit.type !== type) return { name, type, status: "conflict", id: hit.id };

  let id = hit?.id;
  if (!hit && !dryRun) {
    const response = (await context.weeek.post(`/tm/boards/${boardId}/custom-fields`, {
      type,
      name,
    })) as { customField?: { id: string }; id?: string };
    id = response.customField?.id ?? response.id;
    if (id === undefined) {
      throw new Error(`Weeek did not return an id for the created field "${name}".`);
    }
  }
  const outcome: IntakeFieldOutcome = {
    name,
    type,
    status: hit ? "existing" : "created",
    ...(id !== undefined ? { id } : {}),
  };
  if (wanted.type !== "select") return outcome;

  const existingOptions = new Map(
    (hit?.options ?? []).map((option) => [normalizeName(option.name), option])
  );
  const options: BoardItemOutcome[] = [];
  for (const [index, optionName] of wanted.options.entries()) {
    const existing = existingOptions.get(normalizeName(optionName));
    if (existing) {
      options.push({ name: optionName, status: "existing", id: existing.id });
    } else if (dryRun) {
      options.push({ name: optionName, status: "created" });
    } else {
      const response = (await context.weeek.post(
        `/tm/boards/${boardId}/custom-fields/${id}/options`,
        { name: optionName, color: OPTION_COLORS[index % OPTION_COLORS.length] }
      )) as { option?: { id: string } };
      options.push({ name: optionName, status: "created", id: response.option?.id });
    }
  }
  return { ...outcome, options };
}

export async function ensureBoard(
  context: ServerContext,
  options: BoardInitOptions = {}
): Promise<BoardInitReport> {
  const boardId = options.boardId ?? context.boardId;
  const includeOptional = options.includeOptional ?? false;
  const dryRun = options.dryRun ?? false;
  const wanted = [
    ...REQUIRED_ROLES.map((role) => ROLE_COLUMN_NAMES[role]),
    ...(includeOptional ? OPTIONAL_COLUMN_NAMES : []),
  ];
  const seen = new Set<string>();
  const targets = wanted.filter((name) => {
    const normalized = normalizeName(name);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  const existing = await context.boardSchema.getColumns(boardId, true);
  const existingByName = new Map(
    existing.map((column) => [normalizeName(column.name), column])
  );
  const columns: BoardItemOutcome[] = [];

  for (const name of targets) {
    const hit = existingByName.get(normalizeName(name));
    if (hit) {
      columns.push({ name, status: "existing", id: hit.id });
    } else if (dryRun) {
      columns.push({ name, status: "created" });
    } else {
      const response = (await context.weeek.post("/tm/board-columns", {
        boardId,
        name,
      })) as { boardColumn?: { id: number }; id?: number };
      columns.push({
        name,
        status: "created",
        id: response.boardColumn?.id ?? response.id,
      });
    }
  }

  const fields = await context.boardSchema.getCustomFields(boardId, true);
  // Read from the same response as `fields`, so it costs no extra request.
  const fieldsVisible = await context.boardSchema.boardHasTasks(boardId);
  const fieldsByName = new Map(
    fields
      .filter((field) => field.name != null)
      .map((field) => [normalizeName(field.name!), field])
  );
  const customFields: BoardItemOutcome[] = [];
  for (const name of REQUIRED_CUSTOM_FIELD_NAMES) {
    const hit = fieldsByName.get(normalizeName(name));
    if (hit) {
      customFields.push({ name, status: "existing", id: hit.id });
    } else if (!fieldsVisible) {
      customFields.push({ name, status: "skipped" });
    } else if (dryRun) {
      customFields.push({ name, status: "created" });
    } else {
      const response = (await context.weeek.post(
        `/tm/boards/${boardId}/custom-fields`,
        { type: "text", name }
      )) as { customField?: { id: string }; id?: string };
      customFields.push({
        name,
        status: "created",
        id: response.customField?.id ?? response.id,
      });
    }
  }
  const customField = customFields.find(
    (field) => field.name === AI_REPORT_FIELD_NAME
  )!;

  const intakeFields: IntakeFieldOutcome[] = [];
  for (const wanted of context.intakeFields) {
    if (!fieldsVisible) {
      intakeFields.push({ name: wanted.name, type: wanted.type, status: "skipped" });
      continue;
    }
    intakeFields.push(
      await ensureIntakeField(
        context,
        boardId,
        wanted,
        fieldsByName.get(normalizeName(wanted.name)),
        dryRun
      )
    );
  }

  if (!dryRun) context.boardSchema.invalidateBoard(boardId);
  return {
    boardId,
    dryRun,
    includeOptional,
    fieldsVisible,
    createdCount:
      columns.filter((column) => column.status === "created").length +
      customFields.filter((field) => field.status === "created").length +
      intakeFields.filter((field) => field.status === "created").length +
      intakeFields
        .flatMap((field) => field.options ?? [])
        .filter((option) => option.status === "created").length,
    columns,
    customFields,
    customField,
    intakeFields,
  };
}
