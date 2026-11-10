import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";
import { registerCompleteTask } from "../tools/complete-task.js";
import { registerAskQuestion } from "../tools/ask-question.js";
import { registerDownloadImage } from "../tools/download-image.js";
import { registerFinishTask } from "../tools/finish-task.js";
import { registerGetTask } from "../tools/get-task.js";
import { registerInitBoard } from "../tools/init-board.js";
import { registerListBoards } from "../tools/list-boards.js";
import { registerListColumns } from "../tools/list-columns.js";
import { registerListPendingTasks } from "../tools/list-pending-tasks.js";
import { registerListReworkTasks } from "../tools/list-rework-tasks.js";
import { registerListTasks } from "../tools/list-tasks.js";
import { registerMoveTask } from "../tools/move-task.js";
import { registerRejectTask } from "../tools/reject-task.js";
import { registerSetAiReport } from "../tools/set-ai-report.js";
import { registerUpdateTask } from "../tools/update-task.js";
import { SERVER_NAME, SERVER_VERSION } from "../version.js";
import { buildInstructions } from "./instructions.js";

export function createMcpServer(context: ServerContext): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: buildInstructions(context) }
  );

  registerInitBoard(server, context);
  registerListBoards(server, context);
  registerListColumns(server, context);
  registerListTasks(server, context);
  registerListPendingTasks(server, context);
  registerListReworkTasks(server, context);
  registerGetTask(server, context);
  registerAskQuestion(server, context);
  registerMoveTask(server, context);
  registerUpdateTask(server, context);
  registerCompleteTask(server, context);
  registerSetAiReport(server, context);
  registerFinishTask(server, context);
  registerRejectTask(server, context);
  registerDownloadImage(server);
  return server;
}
