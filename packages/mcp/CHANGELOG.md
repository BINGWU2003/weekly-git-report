# @weekly-git-report/mcp

## Unreleased

### Major Changes

- 将旧的 weekly-only 底层工具替换为 `prepare_report`、`complete_report`、`fail_report`
  和 `publish_report`。MCP 现在只承载外部 Agent 报告流程，不管理任务、配置或内置 AI。

## 2.0.1

### Patch Changes

- 18bde2f: 完善项目使用文档，统一安装方式，并补充完整流程、参数语义和错误处理说明。

## 2.0.0

### Major Changes

- b0c5160: 使用显式仓库、分支和作者身份配置替代目录扫描，并在采集前自动同步远程提交。

  开发工具链迁移到 oxlint、oxfmt 与 Vitest，最低 Node.js 版本提升到 20.19。

## 1.0.3

### Patch Changes

- 将 npm 包名从 `@weekly-git-report/mcp-server` 迁移为 `@weekly-git-report/mcp`。

## 1.0.2

### Patch Changes

- d90389e: Add an on-demand Agent CLI for generating weekly summaries without loading MCP tools permanently. Move Skill installation into the human-facing CLI and refactor the MCP server to reuse the shared private workflow layer.
- 支持 skill 调用，抽离公共逻辑

## 1.0.1

### Patch Changes

- 新增 save_week_summary

## 1.0.0

### Major Changes

- 发布 mcp 和 cli
