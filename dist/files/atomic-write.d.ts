import type { ClientChangeStatus } from "../clients/types.js";
/** Общая форма записи на диск: и клиентские конфиги, и файлы скиллов. */
export type WritableChange = {
    path: string;
    before: string;
    after: string;
    status: ClientChangeStatus;
    backup?: boolean;
};
type Applied = {
    change: WritableChange;
    backupPath?: string;
};
export declare function writeAtomicText(filePath: string, text: string, defaultMode?: number): Promise<void>;
export declare function applyClientChanges(changes: readonly WritableChange[]): Promise<Applied[]>;
export {};
