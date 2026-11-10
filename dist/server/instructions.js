export function buildInstructions(context) {
    return [
        `Weeek task-tracker tools for board ${context.boardId}, project ${context.projectId}. ` +
            "New work: weeek_list_pending_tasks. Human-returned work: weeek_list_rework_tasks; keep the queues separate. " +
            "Read with weeek_get_task, move to AI_IN_PROGRESS, implement and verify, then call weeek_finish_task with the completion report; it writes ИИ-отчёт and moves to AWAITING_RELEASE in one update. " +
            "If anything is unclear, use weeek_ask_question; it moves the task to DISCUSS. Wait for the human to answer and return it to AI_REWORK. " +
            "Resolve workflow objects by role/name, never hardcoded IDs.",
        "",
        "Always use weeek_* tools for Weeek operations. Do not bypass them with curl/fetch/Bash.",
        "",
        "Input-side routing fields to read before writing code: URL, Раздел, Локация, and the free-form Уточнение field.",
        "",
        "If detailed review proves a report is stale, already fixed, duplicate, or misunderstood, do not create a cosmetic diff. Use weeek_reject_task with a concrete verification report.",
        "",
        "Use reject when no code change is needed. Use the normal completion workflow when the bug existed and a real fix was made.",
        "",
        "Weeek API notes: task description updates are ignored and public task comments are unavailable. Use ИИ-отчёт for completion reports and weeek_ask_question / ИИ-диалог for clarification history. Use weeek_download_image for signed image attachments because public file URLs can return an HTML meta-refresh wrapper.",
    ].join("\n");
}
