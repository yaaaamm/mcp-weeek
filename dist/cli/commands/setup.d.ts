import type { BoardBinding } from "../../config/board-url.js";
import type { ClientChange, ClientName } from "../../clients/types.js";
import { type SkillChange } from "../../skills/plan.js";
import type { CliFlags } from "../args.js";
import { type Prompt } from "../prompt.js";
export type SetupFlags = {
    boardUrl?: string;
    envFile?: string;
    tokenVariable?: string;
    clients?: readonly ClientName[];
    yes?: boolean;
    dryRun?: boolean;
    repair?: boolean;
    serverName?: string;
    config?: string;
    skills?: boolean;
    overwriteSkills?: boolean;
};
export type SetupDependencies = {
    cwd: string;
    homeDir: string;
    platform: NodeJS.Platform;
    appDataDir?: string;
    executablePath: string;
    commandArgsPrefix?: readonly string[];
    env: NodeJS.ProcessEnv;
    output: (line: string) => void;
    prompt: Prompt;
    validateBoard?: (input: {
        binding: BoardBinding;
        token: string;
    }) => Promise<void>;
    isTracked?: (filePath: string) => Promise<boolean>;
    afterSetupDoctor?: () => Promise<void>;
};
export type SetupResult = {
    projectRoot: string;
    configPath: string;
    canonicalStatus: "added" | "updated" | "unchanged";
    changes: ClientChange[];
    skillChanges: SkillChange[];
    /** Правленые вручную скиллы, которые setup намеренно не тронул. */
    skippedSkills: SkillChange[];
    dryRun: boolean;
};
export declare function runSetup(flags: SetupFlags, dependencies: SetupDependencies): Promise<SetupResult>;
export declare function runSetupCommand(flags: CliFlags): Promise<number>;
