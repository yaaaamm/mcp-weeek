import { McpWeeekError } from "../errors.js";
const COMMANDS = new Set([
    "serve",
    "setup",
    "update",
    "doctor",
    "init-board",
    "help",
]);
function camelCase(value) {
    return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
export function parseCliArgs(argv) {
    if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
        return { command: "help", flags: {} };
    }
    const rawCommand = argv[0];
    if (!COMMANDS.has(rawCommand)) {
        throw new McpWeeekError("CONFIG_INVALID", `Unknown command: ${rawCommand}`);
    }
    const command = rawCommand;
    const flags = {};
    for (let index = 1; index < argv.length; index += 1) {
        const current = argv[index];
        if (!current.startsWith("--")) {
            throw new McpWeeekError("CONFIG_INVALID", `Unexpected argument: ${current}`);
        }
        const separator = current.indexOf("=");
        const rawName = current.slice(2, separator === -1 ? undefined : separator);
        const name = camelCase(rawName);
        if (separator !== -1) {
            flags[name] = current.slice(separator + 1);
            continue;
        }
        const next = argv[index + 1];
        if (next !== undefined && !next.startsWith("--")) {
            flags[name] = next;
            index += 1;
        }
        else {
            flags[name] = true;
        }
    }
    return { command, flags };
}
