import { z } from "zod";
import { normalizeName } from "../board-schema.js";
import { REQUIRED_CUSTOM_FIELD_NAMES } from "../constants.js";

const variableName = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Must be an environment variable name");

export const authSchema = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("env-file"),
      file: z.string().min(1),
      variable: variableName,
    })
    .strict(),
  z
    .object({
      source: z.literal("env"),
      variable: variableName,
    })
    .strict(),
]);

const weeekName = z.string().min(1).max(255);

// Fields the task author fills in (URL, Раздел, …). Names and select options are
// project-specific, so they live here and init-board only ensures they exist.
export const intakeFieldSchema = z.discriminatedUnion("type", [
  z
    .object({
      name: weeekName,
      type: z.literal("text"),
    })
    .strict(),
  z
    .object({
      name: weeekName,
      type: z.literal("select"),
      options: z.array(weeekName).min(1),
    })
    .strict(),
]);

const reservedFieldNames = new Set(
  REQUIRED_CUSTOM_FIELD_NAMES.map((name) => normalizeName(name))
);

// init-board reads the board's fields once, before creating anything, so a name
// repeated here would become a second field or option on the board. Names are
// compared the way the board matches them: ignoring case and extra spaces. The
// AI workflow fields are created by init-board itself and cannot be redeclared.
const intakeFieldsSchema = z.array(intakeFieldSchema).check((ctx) => {
  const firstFieldIndex = new Map<string, number>();
  ctx.value.forEach((field, index) => {
    const key = normalizeName(field.name);
    if (reservedFieldNames.has(key)) {
      ctx.issues.push({
        code: "custom",
        message: `"${field.name}" is reserved for the AI workflow fields`,
        input: field.name,
        path: [index, "name"],
      });
    }
    const firstField = firstFieldIndex.get(key);
    if (firstField === undefined) {
      firstFieldIndex.set(key, index);
    } else {
      ctx.issues.push({
        code: "custom",
        message: `repeats intakeFields[${firstField}] "${ctx.value[firstField].name}"`,
        input: field.name,
        path: [index, "name"],
      });
    }

    if (field.type !== "select") return;
    const firstOptionIndex = new Map<string, number>();
    field.options.forEach((option, optionIndex) => {
      const optionKey = normalizeName(option);
      const firstOption = firstOptionIndex.get(optionKey);
      if (firstOption === undefined) {
        firstOptionIndex.set(optionKey, optionIndex);
      } else {
        ctx.issues.push({
          code: "custom",
          message: `repeats options[${firstOption}] "${field.options[firstOption]}"`,
          input: option,
          path: [index, "options", optionIndex],
        });
      }
    });
  });
});

export const projectConfigSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(1),
    boardUrl: z.string().url(),
    auth: authSchema,
    intakeFields: intakeFieldsSchema.optional(),
  })
  .strict();

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type AuthConfig = z.infer<typeof authSchema>;
export type IntakeField = z.infer<typeof intakeFieldSchema>;
