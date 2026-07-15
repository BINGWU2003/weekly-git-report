# @weekly-git-report/agent-cli

## 1.1.1

### Patch Changes

- 将 Agent Skill 安装能力拆分为独立的 `@weekly-git-report/skill` 包；`@weekly-git-report/cli` 仅保留初始化命令，并更新 Agent CLI 的初始化与扫描指引。

## 1.1.0

### Minor Changes

- d90389e: Add an on-demand Agent CLI for generating weekly summaries without loading MCP tools permanently. Move Skill installation into the human-facing CLI and refactor the MCP server to reuse the shared private workflow layer.

### Patch Changes

- 支持skill调用，抽离公共逻辑
