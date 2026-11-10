import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";

const EXECUTION_RULES = `---

🛑 **ИНСТРУКЦИЯ ДЛЯ ВЫПОЛНЕНИЯ ЭТОЙ ЗАДАЧИ:**

Сделай на 100% рабочее решение разбери детально проблему если нужно use context7 используй анализ. Не выдавай промежуточных решений только то что 100% будет работать и проверь что используешь актуальный код разработки на 2026 год

---`;

type Attachment = {
  id: string;
  name?: string;
  url?: string;
  size?: number;
};

type ImageRole = "bug" | "reference" | "unknown";

type ParsedImage = {
  alt: string;
  context: string;
  role: ImageRole;
  fileName?: string;
  url: string;
};

type CustomFieldOption = { id: string; name: string; color?: string };
type CustomField = {
  id: string;
  name: string | null;
  type: string;
  value: unknown;
  options?: CustomFieldOption[];
};

type TaskShape = {
  id?: number;
  title?: string;
  boardColumnId?: number;
  description?: string | null;
  attachments?: Attachment[];
  customFields?: CustomField[];
};

type GetTaskResponse = {
  success?: boolean;
  task?: TaskShape;
};

type HtmlNode =
  | { kind: "p"; text: string }
  | { kind: "img"; src: string; alt: string };

const REF_KEYWORDS = [
  "надо так",
  "как надо",
  "как должно",
  "как было",
  "должно быть",
  "реф",
  "ref",
  "reference",
  "target",
  "старая",
  "старую",
  "old",
  "мокап",
  "дизайн",
  "макет",
  "надо",
  "нужно",
  "правильно",
  "нормально",
  "хочу",
  "сделай так",
];

const BUG_KEYWORDS = [
  "баг",
  "bug",
  "ошибк",
  "error",
  "проблем",
  "текущ",
  "не работает",
  "было плохо",
  "сейчас так",
  "плохо",
  "есть сейчас",
  "сейчас",
  "было",
  "стало",
];

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(html: string): HtmlNode[] {
  const nodes: HtmlNode[] = [];
  const regex = /<p\b[^>]*>([\s\S]*?)<\/p>|<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const full = match[0];
    if (/^<p\b/i.test(full)) {
      const text = stripTags(match[1] ?? "");
      if (text) nodes.push({ kind: "p", text });
    } else {
      const srcMatch = /src=["']([^"']+)["']/i.exec(full);
      if (!srcMatch) continue;
      const altMatch = /alt=["']([^"']*)["']/i.exec(full);
      nodes.push({
        kind: "img",
        src: srcMatch[1],
        alt: altMatch ? altMatch[1] : "",
      });
    }
  }
  return nodes;
}

function inferRole(text: string): ImageRole {
  const lower = text.toLowerCase();
  if (!lower.trim()) return "unknown";
  for (const w of REF_KEYWORDS) if (lower.includes(w)) return "reference";
  for (const w of BUG_KEYWORDS) if (lower.includes(w)) return "bug";
  return "unknown";
}

function extractImages(
  html: string | null | undefined,
  attachments: Attachment[]
): ParsedImage[] {
  if (!html) return [];
  const nodes = tokenize(html);
  const images: ParsedImage[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.kind !== "img") continue;

    let before = "";
    for (let j = i - 1; j >= 0; j--) {
      const prev = nodes[j];
      if (prev.kind === "img") break;
      if (prev.kind === "p") {
        before = prev.text;
        break;
      }
    }

    const contextParts = [n.alt, before].filter(Boolean);
    const context = contextParts.join(" | ");

    const uuidMatch = /\/files\/([a-f0-9-]+)/i.exec(n.src);
    const uuid = uuidMatch ? uuidMatch[1] : null;
    const attachment = uuid
      ? attachments.find((a) => a.id === uuid)
      : undefined;

    images.push({
      alt: n.alt,
      context,
      role: inferRole(context),
      fileName: attachment?.name,
      url: attachment?.url ?? n.src,
    });
  }
  return images;
}

function formatImageSection(images: ParsedImage[]): string {
  if (images.length === 0) return "";
  const lines = images.map((img, i) => {
    const roleBadge =
      img.role === "bug"
        ? "🔴 БАГ"
        : img.role === "reference"
          ? "🟢 РЕФЕРЕНС"
          : "⚪ без роли";
    const captionLine = img.alt
      ? `подпись: "${img.alt}"`
      : img.context
        ? `контекст: "${img.context}"`
        : "без подписи/контекста";
    const fileLine = img.fileName ? `\n   Файл: ${img.fileName}` : "";
    return `${i + 1}. ${roleBadge} — ${captionLine}\n   URL: ${img.url}${fileLine}`;
  });
  const unknownCount = images.filter((i) => i.role === "unknown").length;
  const hint =
    unknownCount === images.length && images.length > 0
      ? '\n\n⚠️ Ни у одной картинки нет распознанной роли. Если важно различать — попроси пользователя подписать скрины в Weeek (подпись под картинкой: "Баг", "Как надо") или добавить текстовый абзац между картинками ("НАДО ТАК:", "Сейчас:").'
      : "";
  return `---

📷 **КАРТИНКИ ИЗ ОПИСАНИЯ** (роль определяется по alt-подписи И по тексту соседних <p> в описании):

${lines.join("\n\n")}${hint}

---`;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function resolveFieldValue(f: CustomField): unknown {
  if (isEmpty(f.value)) return null;
  if (f.type === "select" && typeof f.value === "string" && f.options) {
    const opt = f.options.find((o) => o.id === f.value);
    return opt ? opt.name : f.value;
  }
  if (f.type === "multiselect" && Array.isArray(f.value) && f.options) {
    return f.value.map((id) => {
      const opt = f.options!.find((o) => o.id === id);
      return opt ? opt.name : id;
    });
  }
  return f.value;
}

function compactCustomFields(fields: CustomField[] | undefined): Array<{
  name: string | null;
  type: string;
  value: unknown;
}> {
  if (!fields) return [];
  return fields
    .filter((f) => f.name)
    .map((f) => ({
      name: f.name,
      type: f.type,
      value: resolveFieldValue(f),
    }));
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `… (+${s.length - max} chars)`;
}

function formatSummary(
  task: TaskShape | undefined,
  compact: Array<{ name: string | null; type: string; value: unknown }>
): string {
  if (!task) return "";
  const header = `📋 **ЗАДАЧА #${task.id ?? "?"}** (колонка ${task.boardColumnId ?? "?"})\n${task.title ?? ""}`;
  const fieldLines = compact.map((f) => {
    const v = f.value;
    if (v === null || v === undefined) {
      return `  • ${f.name}: (пусто)`;
    }
    if (Array.isArray(v)) {
      return `  • ${f.name}: ${v.join(", ")}`;
    }
    const str = typeof v === "string" ? v : JSON.stringify(v);
    return `  • ${f.name}: ${truncate(str, 500)}`;
  });
  const fieldsBlock = fieldLines.length
    ? `\n\n**Поля:**\n${fieldLines.join("\n")}`
    : "";
  return `---\n\n${header}${fieldsBlock}\n\n---`;
}

export function registerGetTask(server: McpServer, context: ServerContext) {
  server.registerTool(
    "weeek_get_task",
    {
      title: "Get Weeek task details",
      description:
        "Get detailed information about a specific Weeek task. Output order: (1) compact summary with title+column+resolved custom field values, (2) full task JSON with resolved select values (option arrays stripped), (3) parsed image roles, (4) execution rules. Image roles come from <img alt> OR the nearest <p> preceding the image. Matches <img src> UUIDs to attachments[] to expose signed download URLs.",
      inputSchema: { taskId: z.number().describe("Task ID") },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ taskId }) => {
      const res = (await context.weeek.get(`/tm/tasks/${taskId}`)) as GetTaskResponse;
      const task = res.task;
      const compactFields = compactCustomFields(task?.customFields);
      const summary = formatSummary(task, compactFields);

      const compactRes = {
        ...res,
        task: task
          ? {
              ...task,
              customFields: compactFields,
            }
          : task,
      };

      const images = extractImages(task?.description, task?.attachments ?? []);
      const imageSection = formatImageSection(images);

      const content: Array<{ type: "text"; text: string }> = [];
      if (summary) content.push({ type: "text", text: summary });
      content.push({ type: "text", text: JSON.stringify(compactRes, null, 2) });
      if (imageSection) content.push({ type: "text", text: imageSection });
      content.push({ type: "text", text: EXECUTION_RULES });

      return { content };
    }
  );
}
