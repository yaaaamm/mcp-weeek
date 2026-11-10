import type { BoardInitReport } from "../../weeek/init-board.js";
import type { CliFlags } from "../args.js";
import { type Prompt } from "../prompt.js";
export type InitBoardFlags = {
    config?: string;
    includeOptional?: boolean;
    yes?: boolean;
};
export type InitBoardDependencies = {
    cwd: string;
    env: NodeJS.ProcessEnv;
    fetch?: typeof globalThis.fetch;
    output: (line: string) => void;
    prompt: Prompt;
};
export type InitBoardResult = {
    applied: boolean;
    report: BoardInitReport;
};
export declare function runInitBoard(flags: InitBoardFlags, dependencies: InitBoardDependencies): Promise<InitBoardResult>;
export declare function runInitBoardCommand(flags: CliFlags): Promise<void>;
