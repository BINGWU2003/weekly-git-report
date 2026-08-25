# @weekly-git-report/cli

## 3.0.0

### Major Changes

- b0c5160: 使用显式仓库、分支和作者身份配置替代目录扫描，并在采集前自动同步远程提交。

  开发工具链迁移到 oxlint、oxfmt 与 Vitest，最低 Node.js 版本提升到 20.19。

## 2.0.0

### Major Changes

- 将 Agent Skill 安装能力拆分为独立的 `@weekly-git-report/skill` 包；`@weekly-git-report/cli` 仅保留初始化命令，并更新 Agent CLI 的初始化与扫描指引。

## 1.0.2

### Patch Changes

- skill 初始化目录矫正

## 1.0.1

### Patch Changes

- 支持 skill 调用，抽离公共逻辑

## 1.0.0

### Major Changes

- 发布 mcp 和 cli
