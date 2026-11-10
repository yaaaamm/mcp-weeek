import { z } from "zod";
export declare const authSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    source: z.ZodLiteral<"env-file">;
    file: z.ZodString;
    variable: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    source: z.ZodLiteral<"env">;
    variable: z.ZodString;
}, z.core.$strict>], "source">;
export declare const intakeFieldSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    name: z.ZodString;
    type: z.ZodLiteral<"text">;
}, z.core.$strict>, z.ZodObject<{
    name: z.ZodString;
    type: z.ZodLiteral<"select">;
    options: z.ZodArray<z.ZodString>;
}, z.core.$strict>], "type">;
export declare const projectConfigSchema: z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    version: z.ZodLiteral<1>;
    boardUrl: z.ZodString;
    auth: z.ZodDiscriminatedUnion<[z.ZodObject<{
        source: z.ZodLiteral<"env-file">;
        file: z.ZodString;
        variable: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        source: z.ZodLiteral<"env">;
        variable: z.ZodString;
    }, z.core.$strict>], "source">;
    intakeFields: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"text">;
    }, z.core.$strict>, z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"select">;
        options: z.ZodArray<z.ZodString>;
    }, z.core.$strict>], "type">>>;
}, z.core.$strict>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type AuthConfig = z.infer<typeof authSchema>;
export type IntakeField = z.infer<typeof intakeFieldSchema>;
