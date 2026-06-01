#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CollectGitLogsInputSchema,
  GetWeekIndexInputSchema,
  ListProjectsInputSchema,
  ReadWeekRawInputSchema,
  ScanProjectsInputSchema,
} from "@weekly-git-report/shared";

import { collectGitLogs } from "./tools/collect-git-logs.js";
import { getWeekIndex } from "./tools/get-week-index.js";
import { listProjects } from "./tools/list-projects.js";
import { jsonResponse } from "./tools/response.js";
import { readWeekRaw } from "./tools/read-week-raw.js";
import { scanProjects } from "./tools/scan-projects.js";

const server = new McpServer({
  name: "weekly-git-report",
  version: "0.0.0",
});

server.registerTool(
  "list_projects",
  {
    description: "List scanned Git projects from ~/.weekly-git-report/projects.json.",
    inputSchema: ListProjectsInputSchema,
  },
  async (input) => jsonResponse(await listProjects(input)),
);

server.registerTool(
  "scan_projects",
  {
    description: "Scan configured or provided roots and update projects.json.",
    inputSchema: ScanProjectsInputSchema,
  },
  async (input) => jsonResponse(await scanProjects(input)),
);

server.registerTool(
  "collect_git_logs",
  {
    description: "Collect Git commits for a date range and write raw weekly report files.",
    inputSchema: CollectGitLogsInputSchema,
  },
  async (input) => jsonResponse(await collectGitLogs(input)),
);

server.registerTool(
  "get_week_index",
  {
    description: "Read index.md for a generated weekly raw report period.",
    inputSchema: GetWeekIndexInputSchema,
  },
  async (input) => jsonResponse(await getWeekIndex(input)),
);

server.registerTool(
  "read_week_raw",
  {
    description: "Read all project Markdown files for a generated weekly raw report period.",
    inputSchema: ReadWeekRawInputSchema,
  },
  async (input) => jsonResponse(await readWeekRaw(input)),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in weekly-git-report MCP server:", error);
  process.exit(1);
});
