# Weekly Git Report

一个从 Git 提交生成工作报告的本地工具。它只处理你明确配置的仓库、分支和作者身份，支持日报、周报、月报和自定义报告，并可通过桌面端、CLI、MCP 或 Agent Skill 使用同一套报告流程。

## 核心能力

- 使用本机 Git 和已有凭据同步仓库，不依赖 GitHub、GitLab 等平台 API。
- 按报告周期、分支和作者身份采集提交，保留可审计的采集数据。
- 使用 OpenAI 或 DeepSeek 生成草稿，也可以交给外部 Agent 生成。
- 在保存前审核和编辑草稿；自动任务也可选择生成后直接保存。
- 为报告正文写入关联信息文件，校验生成来源和内容完整性。
- 将已保存且校验有效的报告推送到飞书群机器人。
- 使用操作系统原生计划任务定时生成报告，不需要后台轮询进程。
- 在 Windows x64 正式安装版中检查并安装 GitHub Releases 更新。

## 选择使用方式

| 方式        | 适合场景                                         | 运行要求                          | 文档                                            |
| ----------- | ------------------------------------------------ | --------------------------------- | ----------------------------------------------- |
| Desktop     | 首次设置、日常生成、草稿审核、报告浏览和定时任务 | Windows x64、Git                  | [桌面端说明](apps/desktop/README.md)            |
| CLI         | 终端配置、脚本和 CI 自动化                       | Node.js 22.13+、Git               | [CLI 说明](packages/cli/README.md)              |
| MCP         | 在支持 MCP 的宿主中由 Agent 生成报告             | Node.js 22.13+、Git、已完成初始化 | [MCP 说明](packages/mcp/README.md)              |
| Agent Skill | 在支持本地 Skill 的 Agent 中直接发起报告请求     | Node.js 22.13+、Git、已完成初始化 | [Skill 规约](skills/weekly-git-report/SKILL.md) |

Desktop 是默认的用户入口。CLI、MCP 和 Skill 使用相同的本地配置、仓库缓存、报告模板和 ReportRun，不会各自维护一套业务规则。

## 快速开始

### Desktop

1. 从 [GitHub Releases](https://github.com/BINGWU2003/weekly-git-report/releases) 下载最新的 Windows x64 安装包。
2. 确认本机已安装 Git，然后启动 Weekly Git Report。
3. 按首次设置引导选择报告目录和仓库缓存目录，并确认 Git 作者身份。
4. 添加至少一个仓库，配置并测试 OpenAI 或 DeepSeek。
5. 生成、审核并保存第一份报告。飞书机器人和报告任务可以稍后配置。

桌面端正式安装包不要求单独安装 Node.js。更完整的说明见[入门指南](docs/getting-started.md)。

### CLI

无需全局安装即可进入交互式菜单：

```sh
npx -y @weekly-git-report/cli@latest
```

完成初始化、添加仓库并运行检查：

```sh
npx -y @weekly-git-report/cli@latest doctor
```

外部 Agent 或脚本可以使用两阶段 Run 协议：

```sh
npx -y @weekly-git-report/cli@latest runs prepare --type weekly
npx -y @weekly-git-report/cli@latest runs complete RUN_ID --file ./weekly-report.md
```

完整命令见 [CLI README](packages/cli/README.md)。

### MCP

将 stdio server 加入 MCP 客户端配置：

```json
{
  "mcpServers": {
    "weekly-git-report": {
      "command": "npx",
      "args": ["-y", "@weekly-git-report/mcp@latest"]
    }
  }
}
```

MCP 提供四个工具：

- `prepare_report`：同步、采集并返回固定模板和脱敏生成输入。
- `complete_report`：保存 Agent 生成的最终 Markdown，可按本次授权推送飞书。
- `fail_report`：显式结束无法完成的 Run。
- `publish_report`：推送已保存的报告或重试失败的推送。

MCP 不负责初始化、仓库管理、内置 AI 或定时任务。完整协议见 [MCP README](packages/mcp/README.md)。

### Agent Skill

使用 Skills CLI 从仓库安装：

```sh
npx skills add BINGWU2003/weekly-git-report
```

重启宿主后，可以直接要求 Agent：

```text
根据 2026-08-17 到 2026-08-23 的 Git 提交生成周报并保存。
```

Skill 会通过 CLI 创建 external-agent Run，并把脱敏的 `generationInput` 作为唯一事实来源；它不会读取采集数据文件、修改配置或创建定时任务。

## 工作原理概览

一次报告生成会经过以下阶段：

1. 选择已配置且启用的仓库。
2. 同步配置分支并按周期、作者身份采集 Git 提交。
3. 写入采集数据、周期索引和 manifest。
4. 固定报告模板版本并生成脱敏的结构化输入。
5. 由内置 AI 或外部 Agent 生成草稿。
6. 审核或自动保存报告正文，同时写入关联信息文件。
7. 根据本次操作或任务配置选择是否推送飞书。

详细流程、周期语义、状态机和系统调度见[工作原理](docs/how-it-works.md)。

## 文档

| 文档                                    | 内容                                       |
| --------------------------------------- | ------------------------------------------ |
| [文档首页](docs/README.md)              | 按使用场景浏览全部文档                     |
| [入门指南](docs/getting-started.md)     | 安装、首次设置和第一份报告                 |
| [工作原理](docs/how-it-works.md)        | ReportRun、周期、审核、推送和定时任务      |
| [系统架构](docs/architecture.md)        | Monorepo 分层、Electron IPC 和模块边界     |
| [数据与存储](docs/data-and-storage.md)  | 配置、SQLite、采集数据、报告正文和历史文件 |
| [安全与隐私](docs/security.md)          | 密钥、脱敏、路径、内容完整性和 Agent 边界  |
| [故障排查](docs/troubleshooting.md)     | Git、同步、AI、飞书、任务和更新问题        |
| [开发指南](docs/development.md)         | 本地开发、验证、构建和贡献约定             |
| [Desktop 发布](docs/desktop-release.md) | Windows 安装包与自动更新发布流程           |

## Monorepo

| 模块                                                                 | 职责                                                |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| [`apps/desktop`](apps/desktop/README.md)                             | Electron 主进程、受限 Preload API 和 React 用户界面 |
| [`packages/cli`](packages/cli/README.md)                             | 交互配置和面向自动化的命令行适配器                  |
| [`packages/mcp`](packages/mcp/README.md)                             | external-agent ReportRun 的 MCP stdio 适配器        |
| [`packages/workflow`](packages/workflow/README.md)                   | 报告运行、AI、飞书和系统调度的用例编排层            |
| [`packages/core`](packages/core/README.md)                           | 配置、Git、采集、模板、报告索引和文件写入           |
| [`packages/shared`](packages/shared/README.md)                       | 跨层常量、Zod Schema 和 TypeScript 类型             |
| [`packages/typescript-config`](packages/typescript-config/README.md) | 共享 TypeScript 与 tsup 配置                        |
| [`skills/weekly-git-report`](skills/weekly-git-report/SKILL.md)      | 外部 Agent 使用 CLI 生成报告的执行规约              |

依赖方向和关键入口见[系统架构](docs/architecture.md)。

## 本地开发

```sh
pnpm install
pnpm format:check
pnpm test
pnpm lint
pnpm check-types
pnpm build
```

项目使用 pnpm workspace、Turborepo、TypeScript、Oxfmt、Oxlint 和 Vitest。详细说明见[开发指南](docs/development.md)。

## 友情链接

- [linux.do](https://linux.do/u/80yan9/)
