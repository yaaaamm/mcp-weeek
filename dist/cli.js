#!/usr/bin/env node
import { parseCliArgs } from "./cli/args.js";
import { runServeCommand } from "./cli/commands/serve.js";
import { runSetupCommand } from "./cli/commands/setup.js";
import { runUpdateCommand } from "./cli/commands/update.js";
import { runDoctorCommand } from "./cli/commands/doctor.js";
import { runInitBoardCommand } from "./cli/commands/init-board.js";
import { McpWeeekError } from "./errors.js";
export const HELP_TEXT = `mcp-weeek <command> [options]

Commands:
  serve       Start the STDIO MCP server
  setup       Configure MCP clients for the current project
  update      Refresh client configs and /weeek-* skills in this project
  doctor      Diagnose project and MCP client configuration
  init-board  Preview or create the Weeek board workflow

Update flow (from any project, no need to visit the mcp-weeek checkout):
  mcp-weeek update --self   Reinstall mcp-weeek itself from git, then rerun update
  mcp-weeek update          Apply the installed version to the current project

setup and update reinstall mcp-weeek from the repository before touching the
project, so a project always gets the current skills.

Options:
  --no-skills         Leave /weeek-* skill files untouched
  --overwrite-skills  Replace skill files that were edited locally
  --no-self-update    Skip the reinstall (offline, or a deliberately pinned build)
  --dry-run           Show the plan without writing anything
`;
export async function main(argv = process.argv.slice(2)) {
    try {
        const invocation = parseCliArgs(argv);
        if (invocation.command === "help") {
            process.stdout.write(HELP_TEXT);
            return 0;
        }
        if (invocation.command === "serve") {
            await runServeCommand(invocation.flags);
            return 0;
        }
        if (invocation.command === "setup") {
            return await runSetupCommand(invocation.flags);
        }
        if (invocation.command === "update") {
            return await runUpdateCommand(invocation.flags);
        }
        if (invocation.command === "doctor") {
            return (await runDoctorCommand(invocation.flags)) ? 0 : 1;
        }
        if (invocation.command === "init-board") {
            await runInitBoardCommand(invocation.flags);
            return 0;
        }
        process.stderr.write(`Command ${invocation.command} is not implemented yet.\n`);
        return 2;
    }
    catch (error) {
        if (error instanceof McpWeeekError) {
            process.stderr.write(`${error.code}: ${error.message}\n`);
        }
        else {
            process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        }
        return 1;
    }
}
process.exitCode = await main();
