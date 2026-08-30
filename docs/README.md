# Weekly Git Report 文档

这里记录 Weekly Git Report 的使用方式、工作原理、系统架构和开发约定。根目录 [README](../README.md) 用于快速了解产品，本目录负责解释跨 Desktop、CLI、MCP 和 Skill 共享的概念。

## 开始使用

- [入门指南](getting-started.md)：安装、首次设置、添加仓库和生成第一份报告。
- [故障排查](troubleshooting.md)：解决 Git、仓库、AI、飞书、任务和更新问题。

## 理解系统

- [工作原理](how-it-works.md)：报告生成流程、ReportRun 状态、周期语义和系统调度。
- [系统架构](architecture.md)：Monorepo 分层、模块依赖、Electron IPC 和主要代码入口。
- [数据与存储](data-and-storage.md)：配置文件、SQLite、采集数据、报告正文和历史文件。
- [安全与隐私](security.md)：密钥存储、数据脱敏、路径限制、完整性校验和 Agent 安全边界。

## 开发与发布

- [开发指南](development.md)：环境、常用命令、测试、构建和文档维护约定。
- [Desktop 发布与更新演练](desktop-release.md)：GitHub Release、Windows 安装包和自动更新验证。

## 按入口查找

| 使用入口    | 入门                                       | 专属参考                                           |
| ----------- | ------------------------------------------ | -------------------------------------------------- |
| Desktop     | [入门指南](getting-started.md#desktop)     | [Desktop README](../apps/desktop/README.md)        |
| CLI         | [入门指南](getting-started.md#cli)         | [CLI README](../packages/cli/README.md)            |
| MCP         | [入门指南](getting-started.md#mcp)         | [MCP README](../packages/mcp/README.md)            |
| Agent Skill | [入门指南](getting-started.md#agent-skill) | [Skill 规约](../skills/weekly-git-report/SKILL.md) |

## 术语

- **采集数据（Raw）**：按日期范围保存的 Git 提交事实、项目文件、索引和 manifest。
- **报告正文（Summary）**：经过审核或自动保存的最终 Markdown 报告。
- **关联信息文件（Sidecar）**：与报告正文同名的 `.meta.json`，记录来源和内容哈希。
- **ReportRun**：一次报告从排队、采集、生成到保存和推送的持久化运行记录。
- **当前周期**：从当前日报、周报或月报起点到今天。
- **上一完整周期**：已经结束的完整一天、自然周或自然月，主要用于定时任务。
