# @weekly-git-report/mcp

## 3.0.0

### Major Changes

- 121caba: 将 MCP 收敛为 external-agent ReportRun 协议，使用 `prepare_report`、`complete_report`、`fail_report` 和 `publish_report` 统一支持日报、周报、月报与自定义报告。

  移除旧的 weekly-only 项目查询、同步、Raw 读取和 Summary 直写工具。MCP 不再暴露任务、配置或内置 AI 能力；飞书仅在用户明确要求后推送。

### Patch Changes

- a87c03d: 新增日报、周报和月报三种生成模板与 `--type` 流程。Summary 保存时写入周期 Sidecar、校验报告周期、备份重复保存内容，并为跨类型覆盖提供显式 `--force`；Doctor 同步检查三种模板和 Summary 元数据。

  现有 MCP 周报工具面保持不变，保存周报时复用新的 Sidecar、周期校验和备份能力。

- 3e05ba1: 新增统一 ReportRun、OpenAI/DeepSeek 内置生成、系统原生定时任务和飞书推送，并让外部 Agent 使用 `runs prepare/complete` 协议。报告模型新增独立自定义类型、类型化 Summary 文件名和 v2 Sidecar；桌面端支持当前周期生成、自定义日期、重新生成与回收站。

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
