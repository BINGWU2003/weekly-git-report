# weekly-git-report

一个本地 Node.js + TypeScript 工具集，用于扫描多个 Git 项目，采集指定周期内的 commit，生成结构化 Markdown 原始记录，并由 Agent 或 MCP 保存周报总结。

项目支持两种主要工作方式：

- Agent Skill 按需模式：只在生成周报时临时运行命令，不常驻 MCP tools。
- MCP 常驻模式：向 MCP Client 注册完整的扫描、采集、读取和保存工具。

## 环境要求

- Node.js 18 或更高版本
- Git
- Windows、macOS 或 Linux

## 应该使用哪个包

| 需求                 | npm 包                         | 命令                    |
| -------------------- | ------------------------------ | ----------------------- |
| 初始化本地配置       | `@weekly-git-report/cli`       | `weekly init`           |
| 安装 Agent Skill     | `@weekly-git-report/skill`     | `weekly-skill install`  |
| Agent 或脚本按需执行 | `@weekly-git-report/agent-cli` | `weekly-agent`          |
| MCP Client 常驻调用  | `@weekly-git-report/mcp`       | `weekly-git-report-mcp` |

完整文档：

- [初始化 CLI](packages/cli/README.md)
- [Skill 安装器](packages/skill/README.md)
- [Agent CLI](packages/agent-cli/README.md)
- [MCP Server](packages/mcp/README.md)

## 快速开始：Agent Skill 模式

适合 Codex、Claude Code 或 opencode。Skill 触发后会按需调用 Agent CLI，不需要配置 MCP。

### 1. 初始化

```sh
npx -y @weekly-git-report/cli@latest init
```

根据提示设置 Git 项目根目录和周报输出目录。

### 2. 安装 Skill

在希望安装 Skill 的项目根目录执行：

```sh
npx -y @weekly-git-report/skill@latest
```

指定客户端：

```sh
npx -y @weekly-git-report/skill@latest install --target codex
npx -y @weekly-git-report/skill@latest install --target claude
npx -y @weekly-git-report/skill@latest install --target opencode
npx -y @weekly-git-report/skill@latest install --target all
```

安装位置：

| Target     | 文件                                          |
| ---------- | --------------------------------------------- |
| `codex`    | `.codex/skills/weekly-git-report/SKILL.md`    |
| `claude`   | `.claude/skills/weekly-git-report/SKILL.md`   |
| `opencode` | `.opencode/skills/weekly-git-report/SKILL.md` |

安装后重启对应客户端，然后要求 Agent 根据 Git 提交生成周报。

### 3. Agent 执行的典型流程

```sh
npx -y @weekly-git-report/agent-cli@latest projects scan
npx -y @weekly-git-report/agent-cli@latest collect --since 2026-06-01 --until 2026-06-07 --all
npx -y @weekly-git-report/agent-cli@latest raw read --start 2026-06-01 --end 2026-06-07
npx -y @weekly-git-report/agent-cli@latest summary save --start 2026-06-01 --end 2026-06-07 --file summary.md
```

通常不需要手动执行这些命令，安装后的 Skill 会指导 Agent 完成流程。

## 快速开始：MCP 模式

### 1. 初始化

```sh
npx -y @weekly-git-report/cli@latest init
```

### 2. 配置 MCP Client

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

### 3. 调用工具

推荐顺序：

1. `scan_projects`
2. `list_projects`
3. `collect_git_logs`
4. `read_week_raw`
5. 让模型基于 raw 生成 Markdown 总结
6. `save_week_summary`

MCP 工具的完整输入和返回结构见 [MCP Server 文档](packages/mcp/README.md)。

## 初始化配置

配置文件位置：

```text
~/.weekly-git-report/config.json
```

默认配置：

```json
{
  "roots": ["~/work", "~/Code", "~/Projects"],
  "excludeDirs": ["node_modules", ".cache", "dist", "build", "vendor", "tmp"],
  "maxDepth": 5,
  "outputRoot": "~/weekly-reports",
  "author": [],
  "defaultSince": "last monday",
  "defaultUntil": "now",
  "includeEmptyProjects": false
}
```

| 字段                   | 类型       | 说明                                     |
| ---------------------- | ---------- | ---------------------------------------- |
| `roots`                | `string[]` | Git 项目扫描根目录                       |
| `excludeDirs`          | `string[]` | 扫描时跳过的目录名                       |
| `maxDepth`             | 正整数     | 最大递归深度                             |
| `outputRoot`           | string     | raw 和 summary 输出根目录                |
| `author`               | `string[]` | 默认 Git 作者；空数组时回退到 Git 用户名 |
| `defaultSince`         | string     | 默认开始时间配置                         |
| `defaultUntil`         | string     | 默认结束时间配置                         |
| `includeEmptyProjects` | boolean    | 是否为无匹配 commit 的项目生成 raw 文件  |

Windows 路径建议使用 `/`：

```json
{
  "roots": ["E:/workspace"],
  "outputRoot": "D:/weekly-reports"
}
```

## 命令速查

### 初始化 CLI

```text
weekly init
```

CLI 只负责初始化，没有其他子命令。完整说明见 [CLI README](packages/cli/README.md)。

### Skill 安装器

```text
weekly-skill install [--target <opencode|claude|codex|all>] [--force]
```

| 参数       | 说明                                   |
| ---------- | -------------------------------------- |
| `--target` | 指定目标客户端；非 TTY 默认 `opencode` |
| `--force`  | 覆盖已有 Skill 文件                    |

完整说明见 [Skill README](packages/skill/README.md)。

### Agent CLI

```text
weekly-agent projects list
weekly-agent projects scan [--root <path>] [--max-depth <number>]
weekly-agent collect --since <YYYY-MM-DD> --until <YYYY-MM-DD> [--author <name>] [--project <id>] [--all]
weekly-agent raw index --start <YYYY-MM-DD> --end <YYYY-MM-DD>
weekly-agent raw read --start <YYYY-MM-DD> --end <YYYY-MM-DD>
weekly-agent summary save --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--file <path>]
```

正常输出为 JSON。完整参数、返回值和管道示例见 [Agent CLI README](packages/agent-cli/README.md)。

### MCP Server

```sh
npx -y @weekly-git-report/mcp@latest
```

提供：

- `scan_projects`
- `list_projects`
- `collect_git_logs`
- `get_week_index`
- `read_week_raw`
- `save_week_summary`

完整 schema 和示例见 [MCP README](packages/mcp/README.md)。

## 数据目录

```text
~/.weekly-git-report/
  config.json
  projects.json

{outputRoot}/
  raw/{YYYY}/{MM}/{start}_{end}/
    index.md
    manifest.json
    {project}.md
  summary/{YYYY}/{MM}/{start}_{end}.md
```

### `projects.json`

由 `projects scan` 或 MCP 的 `scan_projects` 创建，保存项目 id、名称、路径、remote、branch 和最近提交时间。

### raw 目录

每个采集周期包含：

- `index.md`：周期和项目概览
- `manifest.json`：项目文件、commit 数量、hash 和错误清单
- `{project}.md`：单个项目的 Git 原始记录

### summary 目录

总结文件路径：

```text
{outputRoot}/summary/{YYYY}/{MM}/{start}_{end}.md
```

## 幂等与安全策略

- 同一项目和周期始终使用同一个 Markdown 文件。
- 默认覆盖写入，不生成 `-copy`、`-new` 等重复文件。
- 内容未变化时可以跳过重复 raw 写入。
- raw 读取只处理 manifest 声明的项目文件。
- workflow 会拒绝访问解析后位于 `outputRoot` 之外的路径。

## 从 CLI 1.x 迁移

`@weekly-git-report/cli` 2.0 只保留初始化职责：

| 旧命令                 | 新方式                       |
| ---------------------- | ---------------------------- |
| `weekly scan`          | `weekly-agent projects scan` |
| `weekly list`          | `weekly-agent projects list` |
| `weekly collect`       | `weekly-agent collect`       |
| `weekly skill install` | `weekly-skill install`       |

使用 `npx` 的迁移示例：

```sh
npx -y @weekly-git-report/agent-cli@latest projects scan
npx -y @weekly-git-report/skill@latest
```

## Monorepo 结构

| 包                           | 发布 | 职责                                  |
| ---------------------------- | ---- | ------------------------------------- |
| `packages/cli`               | 是   | 初始化配置和输出目录                  |
| `packages/skill`             | 是   | 安装 Agent Skill                      |
| `packages/agent-cli`         | 是   | 面向 Agent 和脚本的非交互 JSON CLI    |
| `packages/mcp`               | 是   | MCP stdio server                      |
| `packages/workflow`          | 否   | MCP 与 Agent CLI 共用的业务流程       |
| `packages/core`              | 否   | 配置、路径、Git、扫描、采集和文件写入 |
| `packages/shared`            | 否   | 常量、Zod schemas 和类型              |
| `packages/eslint-config`     | 否   | 共享 ESLint 配置                      |
| `packages/typescript-config` | 否   | 共享 TypeScript 和 tsup 配置          |

## 本地开发

```sh
pnpm install
pnpm lint
pnpm check-types
pnpm build
```

单包命令：

```sh
pnpm --filter @weekly-git-report/cli build
pnpm --filter @weekly-git-report/skill build
pnpm --filter @weekly-git-report/agent-cli check-types
pnpm --filter @weekly-git-report/mcp lint
```

本地运行构建产物：

```sh
node packages/cli/dist/index.js --help
node packages/skill/dist/index.js --help
node packages/agent-cli/dist/index.js --help
node packages/mcp/dist/index.js
```

## 版本与发布

项目使用 Changesets：

```sh
pnpm changeset
pnpm version-packages
pnpm release
```

GitHub Release Action 会在 main 分支上创建版本 PR，合并版本 PR 后发布到 npm。发布需要仓库 Secret `NPM_TOKEN`。

手动发布时：

```sh
export NPM_TOKEN=your-npm-token
pnpm release
```

PowerShell：

```powershell
$env:NPM_TOKEN="your-npm-token"
pnpm release
```
