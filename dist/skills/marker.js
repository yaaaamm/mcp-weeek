import { createHash } from "node:crypto";
import { SERVER_VERSION } from "../version.js";
/**
 * Установленный SKILL.md помечается строкой во фронтматтере: версия пакета,
 * который его положил, и хеш того, что было записано. Без этой пометки нельзя
 * отличить «файл не трогали, просто вышла новая версия шаблона» от «человек
 * правил файл руками» — и любое обновление превращается в вопрос про каждый
 * файл. Пометка делает тихое обновление нетронутых файлов безопасным.
 */
const MARKER_KEY = "x-mcp-weeek";
const MARKER_LINE = new RegExp(`^${MARKER_KEY}:.*$\\n?`, "m");
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
export function contentHash(text) {
    return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}
export function stripMarker(text) {
    const frontmatter = FRONTMATTER.exec(text);
    if (!frontmatter)
        return text;
    const cleaned = frontmatter[0].replace(MARKER_LINE, "");
    return cleaned + text.slice(frontmatter[0].length);
}
export function readMarker(text) {
    const frontmatter = FRONTMATTER.exec(text);
    if (!frontmatter)
        return null;
    const line = MARKER_LINE.exec(frontmatter[0]);
    if (!line)
        return null;
    const value = line[0].slice(`${MARKER_KEY}:`.length).trim();
    const [version, hash] = value.split(/\s+/);
    if (!version || !hash)
        return null;
    return { version, hash };
}
/** Возвращает содержимое с пометкой; хеш считается по тексту БЕЗ неё. */
export function applyMarker(rendered, version = SERVER_VERSION) {
    const clean = stripMarker(rendered);
    const frontmatter = FRONTMATTER.exec(clean);
    if (!frontmatter) {
        throw new Error("Skill template must start with a YAML frontmatter block");
    }
    const marker = `${MARKER_KEY}: ${version} ${contentHash(clean)}\n`;
    const closingOffset = frontmatter[0].length - "---\n".length;
    return clean.slice(0, closingOffset) + marker + clean.slice(closingOffset);
}
export function ownershipOf(existing) {
    if (existing === "")
        return "absent";
    const marker = readMarker(existing);
    if (!marker)
        return "foreign";
    return contentHash(stripMarker(existing)) === marker.hash ? "managed" : "modified";
}
