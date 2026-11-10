import { z } from "zod";
const META_REFRESH_RE = /<meta[^>]*http-equiv=["']refresh["'][^>]*content=["']\d+\s*;\s*url=['"]?([^"']+?)['"]?["']/i;
function detectMimeType(bytes) {
    if (bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47) {
        return "image/png";
    }
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return "image/jpeg";
    }
    if (bytes.length >= 6 &&
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38) {
        return "image/gif";
    }
    if (bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50) {
        return "image/webp";
    }
    return "application/octet-stream";
}
async function fetchFollowingMetaRefresh(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching ${url.slice(0, 100)}…`);
    }
    const ct = res.headers.get("content-type") ?? "";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (ct.includes("text/html")) {
        const html = new TextDecoder("utf-8").decode(buf);
        const match = META_REFRESH_RE.exec(html);
        if (!match) {
            throw new Error("Got HTML response but no <meta http-equiv='refresh'> URL inside.");
        }
        const redirect = match[1].replace(/&amp;/g, "&").trim();
        const res2 = await fetch(redirect);
        if (!res2.ok) {
            throw new Error(`HTTP ${res2.status} fetching redirect target.`);
        }
        return new Uint8Array(await res2.arrayBuffer());
    }
    return buf;
}
const MAX_BYTES = 5 * 1024 * 1024;
export function registerDownloadImage(server) {
    server.registerTool("weeek_download_image", {
        title: "Download a Weeek image attachment as inline content",
        description: "Download an image from a Weeek signed URL (the .url field on attachments[] returned by weeek_get_task). Handles Weeek's HTML meta-refresh wrapper (Weeek public file URLs return an HTML stub redirecting to Selectel S3 storage; raw curl/fetch without meta-refresh handling gets only 2KB of HTML, not the image). Returns the image as an MCP image content block so the multimodal agent can SEE it directly — no local download or Read step needed. Use when image roles (bug/reference) parsed from get-task aren't enough and visual inspection is required.",
        inputSchema: {
            url: z
                .string()
                .url()
                .describe("Signed URL from attachments[].url in weeek_get_task response (must include ?expires= and ?signature= params)."),
        },
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ url }) => {
        const bytes = await fetchFollowingMetaRefresh(url);
        if (bytes.length > MAX_BYTES) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Image too large for inline embedding: ${bytes.length} bytes (max ${MAX_BYTES}). Skip embedding or scale down.`,
                    },
                ],
                isError: true,
            };
        }
        const mimeType = detectMimeType(bytes);
        if (!mimeType.startsWith("image/")) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Downloaded data is not a recognized image format (detected: ${mimeType}, ${bytes.length} bytes). URL may be invalid/expired.`,
                    },
                ],
                isError: true,
            };
        }
        const base64 = Buffer.from(bytes).toString("base64");
        return {
            content: [
                {
                    type: "image",
                    data: base64,
                    mimeType,
                },
            ],
        };
    });
}
