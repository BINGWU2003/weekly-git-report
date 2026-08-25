#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CollectGitLogsInputSchema,
  GetWeekIndexInputSchema,
  ListProjectsInputSchema,
  ReadWeekRawInputSchema,
  SaveWeekSummaryInputSchema,
  SyncProjectsInputSchema,
} from "@weekly-git-report/shared";

import { collectGitLogs } from "./tools/collect-git-logs.js";
import { getWeekIndex } from "./tools/get-week-index.js";
import { listProjects } from "./tools/list-projects.js";
import { jsonResponse } from "./tools/response.js";
import { readWeekRaw } from "./tools/read-week-raw.js";
import { saveWeekSummary } from "./tools/save-week-summary.js";
import { syncProjects } from "./tools/sync-projects.js";

const server = new McpServer({
  name: "weekly-git-report",
  version: "0.0.0",
});

server.registerTool(
  "list_projects",
  {
    description: "列出 ~/.weekly-git-report/projects.json 中显式配置的 Git 项目。",
    inputSchema: ListProjectsInputSchema,
  },
  async (input) => jsonResponse(await listProjects(input)),
);

server.registerTool(
  "sync_projects",
  {
    description: "同步显式配置的远程 Git 项目和分支。",
    inputSchema: SyncProjectsInputSchema,
  },
  async (input) => jsonResponse(await syncProjects(input)),
);

server.registerTool(
  "collect_git_logs",
  {
    description: "采集指定时间范围内的 Git 提交记录，并写入周报原始记录文件。",
    inputSchema: CollectGitLogsInputSchema,
  },
  async (input) => jsonResponse(await collectGitLogs(input)),
);

server.registerTool(
  "get_week_index",
  {
    description: "读取指定周期已生成的周报原始记录索引 index.md。",
    inputSchema: GetWeekIndexInputSchema,
  },
  async (input) => jsonResponse(await getWeekIndex(input)),
);

server.registerTool(
  "read_week_raw",
  {
    description: "读取指定周期已生成的所有项目 Markdown 原始记录。",
    inputSchema: ReadWeekRawInputSchema,
  },
  async (input) => jsonResponse(await readWeekRaw(input)),
);

server.registerTool(
  "save_week_summary",
  {
    description: "保存指定周期的周报总结 Markdown 到 summary 目录。",
    inputSchema: SaveWeekSummaryInputSchema,
  },
  async (input) => jsonResponse(await saveWeekSummary(input)),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in weekly-git-report MCP server:", error);
  process.exit(1);
});
