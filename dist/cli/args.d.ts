export type CliCommand = "serve" | "setup" | "update" | "doctor" | "init-board" | "help";
export type CliFlags = Record<string, string | boolean>;
export type CliInvocation = {
    command: CliCommand;
    flags: CliFlags;
};
export declare function parseCliArgs(argv: string[]): CliInvocation;
