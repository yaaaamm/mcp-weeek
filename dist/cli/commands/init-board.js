import { ensureBoard, fieldsHiddenMessage } from "../../weeek/init-board.js";
import { loadServerContext } from "../../server/serve.js";
import { createPrompt } from "../prompt.js";
function missingNames(report) {
    return [
        ...report.columns
            .filter((column) => column.status === "created")
            .map((column) => column.name),
        ...report.customFields
            .filter((field) => field.status === "created")
            .map((field) => field.name),
        ...report.intakeFields.flatMap((field) => [
            ...(field.status === "created" ? [field.name] : []),
            ...(field.options ?? [])
                .filter((option) => option.status === "created")
                .map((option) => `${field.name}: ${option.name}`),
        ]),
    ];
}
export async function runInitBoard(flags, dependencies) {
    const context = await loadServerContext({
        configPath: flags.config,
        cwd: dependencies.cwd,
        env: dependencies.env,
        fetch: dependencies.fetch,
    });
    const preview = await ensureBoard(context, {
        includeOptional: flags.includeOptional,
        dryRun: true,
    });
    // Said before the plan, so the user knows the fields are left out before
    // confirming the columns.
    if (!preview.fieldsVisible) {
        dependencies.output(fieldsHiddenMessage(preview.boardId));
    }
    for (const field of preview.intakeFields) {
        if (field.status === "conflict") {
            dependencies.output(`Skipping "${field.name}": a field with this name exists but is not ${field.type}.`);
        }
    }
    const missing = missingNames(preview);
    if (missing.length === 0) {
        if (preview.fieldsVisible) {
            dependencies.output("Board workflow is already initialized.");
        }
        return { applied: false, report: preview };
    }
    dependencies.output("Would create:");
    for (const name of missing)
        dependencies.output(`- ${name}`);
    if (!flags.yes && !(await dependencies.prompt.confirm("Create these objects?"))) {
        return { applied: false, report: preview };
    }
    const report = await ensureBoard(context, {
        includeOptional: flags.includeOptional,
        dryRun: false,
    });
    dependencies.output(`Created ${report.createdCount} board object(s).`);
    return { applied: true, report };
}
export async function runInitBoardCommand(flags) {
    const prompt = createPrompt();
    try {
        await runInitBoard({
            config: typeof flags.config === "string" ? flags.config : undefined,
            includeOptional: flags.includeOptional === true,
            yes: flags.yes === true,
        }, {
            cwd: process.cwd(),
            env: process.env,
            output: (line) => process.stdout.write(`${line}\n`),
            prompt,
        });
    }
    finally {
        prompt.close?.();
    }
}
