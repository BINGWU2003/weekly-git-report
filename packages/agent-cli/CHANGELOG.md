# @weekly-git-report/agent-cli

## 2.0.1

### Patch Changes

- 18bde2f: 完善项目使用文档，统一安装方式，并补充完整流程、参数语义和错误处理说明。

## 2.0.0

### Major Changes

- b0c5160: 使用显式仓库、分支和作者身份配置替代目录扫描，并在采集前自动同步远程提交。

  开发工具链迁移到 oxlint、oxfmt 与 Vitest，最低 Node.js 版本提升到 20.19。

## 1.1.1

### Patch Changes

- 将 Agent Skill 安装能力拆分为独立的 `@weekly-git-report/skill` 包；`@weekly-git-report/cli` 仅保留初始化命令，并更新 Agent CLI 的初始化与扫描指引。

## 1.1.0

### Minor Changes

- d90389e: Add an on-demand Agent CLI for generating weekly summaries without loading MCP tools permanently. Move Skill installation into the human-facing CLI and refactor the MCP server to reuse the shared private workflow layer.

### Patch Changes

- 支持 skill 调用，抽离公共逻辑
