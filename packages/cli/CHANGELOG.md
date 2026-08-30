# @weekly-git-report/cli

## 4.0.0

### Major Changes

- a45f53e: 将 Agent 自动化命令合并到统一的 `weekly` CLI，并提供 `collect`、`raw`、`summary` 以及稳定 JSON 项目命令。新增从本地文件夹批量识别、同步和添加仓库的 `projects import`，项目查询和同步结果附带配置分支的本地最新提交状态。新增 `templates init/read/write/reset` 管理 CLI、Electron 与 Agent 共用的周报生成提示词。Agent Skill 改为通过通用 Skills CLI 从仓库安装，并通过 CLI 动态读取生成规则。

### Minor Changes

- a87c03d: 新增日报、周报和月报三种生成模板与 `--type` 流程。Summary 保存时写入周期 Sidecar、校验报告周期、备份重复保存内容，并为跨类型覆盖提供显式 `--force`；Doctor 同步检查三种模板和 Summary 元数据。

  现有 MCP 周报工具面保持不变，保存周报时复用新的 Sidecar、周期校验和备份能力。

- 3e05ba1: 新增统一 ReportRun、OpenAI/DeepSeek 内置生成、系统原生定时任务和飞书推送，并让外部 Agent 使用 `runs prepare/complete` 协议。报告模型新增独立自定义类型、类型化 Summary 文件名和 v2 Sidecar；桌面端支持当前周期生成、自定义日期、重新生成与回收站。

## 3.0.1

### Patch Changes

- 18bde2f: 完善项目使用文档，统一安装方式，并补充完整流程、参数语义和错误处理说明。

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
