export type SkillMarker = {
    version: string;
    hash: string;
};
export type SkillOwnership = 
/** Файла нет. */
"absent"
/** Положен инструментом и с тех пор не изменялся. */
 | "managed"
/** Есть пометка, но содержимое с ней разошлось — правили руками. */
 | "modified"
/** Пометки нет вовсе — файл появился до этой версии или скопирован руками. */
 | "foreign";
export declare function contentHash(text: string): string;
export declare function stripMarker(text: string): string;
export declare function readMarker(text: string): SkillMarker | null;
/** Возвращает содержимое с пометкой; хеш считается по тексту БЕЗ неё. */
export declare function applyMarker(rendered: string, version?: string): string;
export declare function ownershipOf(existing: string): SkillOwnership;
