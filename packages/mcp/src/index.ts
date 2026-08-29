#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CompleteReportInputSchema,
  FailReportInputSchema,
  PrepareReportInputSchema,
  PublishReportInputSchema,
} from "@weekly-git-report/shared";

import { completeReport } from "./tools/complete-report.js";
import { failReport } from "./tools/fail-report.js";
import { prepareReport } from "./tools/prepare-report.js";
import { publishReport } from "./tools/publish-report.js";
import { jsonResponse } from "./tools/response.js";

const server = new McpServer({
  name: "weekly-git-report",
  version: "0.0.0",
});

server.registerTool(
  "prepare_report",
  {
    description:
      "准备一次外部 Agent 报告：同步并采集已配置仓库，返回固定模板和脱敏 generationInput；不会调用内置 AI。",
    inputSchema: PrepareReportInputSchema,
  },
  async (input) => jsonResponse(await prepareReport(input)),
);

server.registerTool(
  "complete_report",
  {
    description:
      "提交外部 Agent 生成的 Markdown，校验本次 Raw 和模板后保存 Summary；仅 publish=true 时尝试推送飞书。",
    inputSchema: CompleteReportInputSchema,
  },
  async (input) => jsonResponse(await completeReport(input)),
);

server.registerTool(
  "fail_report",
  {
    description: "外部 Agent 无法完成生成时，显式结束对应 Run 并记录失败原因。",
    inputSchema: FailReportInputSchema,
  },
  async (input) => jsonResponse(failReport(input)),
);

server.registerTool(
  "publish_report",
  {
    description:
      "推送指定 Run 已保存且校验有效的 Summary 到飞书，也用于重试 publish_failed 的推送。",
    inputSchema: PublishReportInputSchema,
  },
  async (input) => jsonResponse(await publishReport(input)),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in weekly-git-report MCP server:", error);
  process.exit(1);
});
