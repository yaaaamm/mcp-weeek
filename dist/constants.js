// Board/column identity is resolved BY NAME at runtime (see board-schema.ts),
// not by hardcoded IDs — so one server instance works against any board that
// carries these canonical column names. Point an instance at its board via the
// WEEEK_BOARD_ID / WEEEK_PROJECT_ID env vars (per-project .mcp.json).
export const DEFAULT_BOARD_ID = Number(process.env.WEEEK_BOARD_ID ?? 133);
export const DEFAULT_PROJECT_ID = process.env.WEEEK_PROJECT_ID
    ? Number(process.env.WEEEK_PROJECT_ID)
    : undefined;
// Workflow roles → canonical column names. Matching is case-insensitive and
// whitespace-normalized (see board-schema.ts), so "Ожидает Релиза" == "Ожидает релиза".
export const COLUMN_ROLES = [
    "SOURCE_ERRORS",
    "SOURCE_IMPROVEMENTS",
    "DISCUSS",
    "AI_IN_PROGRESS",
    "AI_REWORK",
    "AWAITING_RELEASE",
    "AI_DONE",
    "REJECT_CONFIRM",
];
export const ROLE_COLUMN_NAMES = {
    SOURCE_ERRORS: "Ошибки",
    SOURCE_IMPROVEMENTS: "Доработки",
    DISCUSS: "Обсудить",
    AI_IN_PROGRESS: "ИИ в работе",
    AI_REWORK: "Доработать ИИ",
    AWAITING_RELEASE: "Ожидает релиза",
    AI_DONE: "ВЫПОЛНЕНО ИИ",
    REJECT_CONFIRM: "Подтвердить (у меня нет такой ошибки)",
};
// Columns weeek_init_board guarantees on every board: every column some weeek_*
// tool moves a task INTO. REJECT_CONFIRM belongs here and not below — it is the
// write target of weeek_reject_task, so a board without it has a broken tool,
// not merely a thinner manual workflow.
export const REQUIRED_ROLES = [
    "SOURCE_ERRORS",
    "SOURCE_IMPROVEMENTS",
    "DISCUSS",
    "AI_IN_PROGRESS",
    "AI_REWORK",
    "AWAITING_RELEASE",
    "AI_DONE",
    "REJECT_CONFIRM",
];
// Optional manual-workflow columns — pure human bookkeeping, no weeek_*
// tool reads or writes them. Created only when init is called with
// includeOptional: true.
export const OPTIONAL_COLUMN_NAMES = [
    "Ручная доработка",
    "Готово",
    "Принято Manual",
];
// Text custom field the AI writes its completion report into.
export const AI_REPORT_FIELD_NAME = "ИИ-отчёт";
// Append-only clarification history shared by the AI and human reviewer.
export const AI_DIALOG_FIELD_NAME = "ИИ-диалог";
export const REQUIRED_CUSTOM_FIELD_NAMES = [
    AI_REPORT_FIELD_NAME,
    AI_DIALOG_FIELD_NAME,
];
// Colors Weeek accepts for a select option (CustomFieldOption.color enum).
// init-board cycles through them for intake-field options.
export const OPTION_COLORS = [
    "blue",
    "light_blue",
    "dark_purple",
    "purple",
    "dark_pink",
    "pink",
    "light_pink",
    "red",
];
