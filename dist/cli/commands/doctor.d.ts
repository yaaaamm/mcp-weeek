import type { ClientName } from "../../clients/types.js";
import { type McpWeeekErrorCode } from "../../errors.js";
import { type ServerContext } from "../../server-context.js";
import type { CliFlags } from "../args.js";
export type DoctorStatus = "pass" | "warn" | "fail";
export type DoctorCheck = {
    name: string;
    status: DoctorStatus;
    code?: McpWeeekErrorCode;
    message: string;
};
export type DoctorReport = {
    ok: boolean;
    checks: DoctorCheck[];
};
export type DoctorFlags = {
    clients?: readonly ClientName[];
    config?: string;
    serverName?: string;
};
export type DoctorDependencies = {
    cwd: string;
    homeDir: string;
    platform: NodeJS.Platform;
    appDataDir?: string;
    executablePath: string;
    commandArgsPrefix?: readonly string[];
    env: NodeJS.ProcessEnv;
    fetch?: typeof globalThis.fetch;
    output: (line: string) => void;
    isTracked?: (filePath: string) => Promise<boolean>;
    handshake?: (context: ServerContext) => Promise<void>;
};
export declare function runDoctor(flags: DoctorFlags, dependencies: DoctorDependencies): Promise<DoctorReport>;
export declare function runDoctorCommand(flags: CliFlags): Promise<boolean>;
