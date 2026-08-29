# weekly-git-report

一个本地运行的 Git 报告工具集，支持日报、周报和月报。它只处理你显式配置的仓库、分支和作者身份，可由 Electron 内置 AI、系统定时任务或外部 Agent 通过同一 ReportRun 流程生成、审核、保存并推送飞书。

## 环境要求

- Node.js 22.12+
- Git
- Windows、macOS 或 Linux

## 快速开始

### 1. 初始化配置

可以使用 Electron 桌面端在“设置 → 常规”中直接初始化，也可以在交互式终端运行：

```sh
npx -y @weekly-git-report/cli@latest
```

选择 `Initialize configuration`，按提示设置输出目录和 Git 作者身份，然后添加至少一个仓库。添加仓库时会配置：

- 仓库 URL 和分支
- 仓库名称
- 本地缓存路径
- 使用全局身份或项目专属身份
- 是否启用该仓库

仓库默认以裸仓库形式缓存在本地，不检出工作区。自定义缓存路径也可以指向已有 Git 仓库，但其 `origin` 必须与配置的 URL 一致。

已有多个本地开发仓库时，可以在 Electron 仓库页选择父目录批量导入，或运行：

```sh
npx -y @weekly-git-report/cli@latest projects import /path/to/code
```

导入只读取本地仓库的 `origin`，实际采集仍使用 `repositoryCacheRoot` 下的独立 Bare Git 缓存，不修改开发工作区。

### 2. 选择使用方式

| 方式        | 适合场景                                               | 入口                                                     |
| ----------- | ------------------------------------------------------ | -------------------------------------------------------- |
| Agent Skill | 希望直接在 Codex、Claude Code 或其他 Agent 中生成报告  | [`weekly-git-report`](skills/weekly-git-report/SKILL.md) |
| MCP         | 使用支持 MCP 的客户端，并希望通过 tools 编排采集与保存 | [`@weekly-git-report/mcp`](packages/mcp/README.md)       |
| CLI         | 交互配置，或由 Agent、脚本和 CI 使用稳定 JSON 命令     | [`@weekly-git-report/cli`](packages/cli/README.md)       |
| Electron    | GUI 初始化、内置 AI、任务调度、运行审核和报告库        | [`apps/desktop`](apps/desktop/README.md)                 |

#### Agent Skill

使用通用 Skills CLI 从仓库安装：

```sh
npx skills add BINGWU2003/weekly-git-report
```

重启客户端后，可以直接要求 Agent：

```text
根据 2026-08-17 到 2026-08-23 的 Git 提交生成周报并保存。
```

Skill 会指导 Agent 调用统一 CLI，读取可编辑的生成模板，完成同步、采集、读取 raw 和保存 summary。

#### MCP

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

MCP 提供 `list_projects`、`sync_projects`、`collect_git_logs`、`get_week_index`、`read_week_raw` 和 `save_week_summary` 六个 tool。

#### CLI 自动化

外部 Agent 推荐使用统一 Run 协议：

```sh
npx -y @weekly-git-report/cli@latest runs prepare --type weekly --start 2026-08-17 --end 2026-08-23
npx -y @weekly-git-report/cli@latest runs complete RUN_ID --file ./weekly-summary.md
```

如果同周期已有报告但元数据无法校验，在确认覆盖后为 `runs complete` 追加 `--force`；原报告会先备份到 Summary 目录下的 `.history`。

`collect` 会先同步选中的仓库，因此通常不需要提前执行 `projects sync`。命令成功后分别返回包含输出路径、raw 内容或 summary 路径的 JSON。

## 工作流程

一次采集会依次执行：

1. 从显式配置中选择已启用的项目。
2. 验证本地仓库的 `origin`。
3. fetch 配置的远程分支到 `refs/remotes/origin/{branch}`。
4. 从该远程引用读取指定日期范围内的提交，不依赖本地 `HEAD`。
5. 按命令行作者、项目作者或全局身份的优先级过滤提交。
6. 写入 raw 索引、manifest 和各项目 Markdown。
7. Agent 按报告类型读取共享提示词模板，根据 Raw 内容生成总结，并通过 CLI 写入 Summary Markdown 和 Sidecar。

命令行传入的作者按完整姓名或完整邮箱匹配，不区分大小写。未传作者时，项目的 `authors` 优先于全局 `identities`。

单个项目同步或采集失败时，其他项目会继续处理，错误会进入结果的 `errors`，命令退出码为 `1`。失败项目不会回退到旧缓存来冒充最新结果。

Electron 仓库页和 `projects list/sync` JSON 会从本地缓存的 `refs/remotes/origin/{branch}` 读取采集分支最新提交；读取运行状态不会访问 GitLab、GitHub 或其他远程 API。

## 配置文件

全局配置位于 `~/.weekly-git-report/config.json`：

```json
{
  "outputRoot": "~/weekly-reports",
  "repositoryCacheRoot": "~/.weekly-git-report/repositories",
  "includeEmptyProjects": false,
  "identities": [{ "name": "张三", "email": "zhangsan@example.com" }]
}
```

| 字段                   | 说明                                  |
| ---------------------- | ------------------------------------- |
| `outputRoot`           | raw 和 summary 的根目录               |
| `repositoryCacheRoot`  | 默认仓库缓存目录                      |
| `includeEmptyProjects` | 是否为没有匹配提交的项目生成 raw 文件 |
| `identities`           | 默认 Git 作者身份，至少配置一个       |

项目配置位于 `~/.weekly-git-report/projects.json`：

```json
{
  "projects": [
    {
      "id": "github.com/example/project-a",
      "name": "project-a",
      "url": "git@github.com:example/project-a.git",
      "branch": "main",
      "localPath": "C:/Users/name/.weekly-git-report/repositories/project-a-a1b2c3d4",
      "enabled": true
    }
  ]
}
```

项目可以通过 `authors` 覆盖全局身份。`localPath` 在添加项目时计算并保存；默认目录名包含 URL 的 8 位短哈希，避免同名仓库冲突。

## 输出目录

```text
~/.weekly-git-report/
  config.json
  projects.json
  ai.json
  feishu.json
  tasks.json
  runs.db
  runs/{runId}/generation-input.json
  repositories/
  templates/
    daily/summary.md
    weekly/summary.md
    monthly/summary.md
    custom/summary.md

{outputRoot}/
  raw/{YYYY}/{MM}/{start}_{end}/
    index.md
    manifest.json
    {project}-{urlHash}.md
  summary/{YYYY}/{MM}/
    {start}_{end}.{daily|weekly|monthly}.md
    {start}_{end}.custom.{reportId}.md
    *.meta.json
  summary/.trash/
```

- `index.md`：本周期的项目索引。
- `manifest.json`：周期、项目文件、提交数量和错误等结构化元数据。
- `{project}-{urlHash}.md`：单个项目的提交记录。
- `summary/...md`：审核或自动保存后的最终日报、周报、月报或自定义报告；不同类型使用独立文件名。
- `summary/...meta.json`：报告 ID、类型、Run、生成器、模型、模板和 Raw Hash、周期及 Markdown 内容 Hash；缺失或无效时不可推送。
- `summary/.trash/`：桌面端回收站，保留 Markdown、Sidecar 与原始位置清单。
- `templates/{daily,weekly,monthly,custom}/summary.md`：CLI 与 Electron 共用的四种生成提示词。

raw 读取和 summary 写入都限制在配置的 `outputRoot` 内。

## 常见问题

### 提示配置不存在

在 Electron 的“设置 → 常规”完成初始化，或在交互式终端运行
`npx -y @weekly-git-report/cli@latest init`。

### 本地仓库无法同步

运行以下命令检查 Git、配置文件、本地路径和 `origin`：

```sh
npx -y @weekly-git-report/cli@latest doctor
```

如果自定义路径已存在，它必须是空目录，或是 `origin` 与配置 URL 一致的 Git 仓库。

### 周报中没有某些提交

依次检查项目是否已启用、配置分支是否正确、日期范围是否覆盖提交时间，以及作者姓名或邮箱是否完整匹配。

## Monorepo

| 包                                                 | 职责                                      |
| -------------------------------------------------- | ----------------------------------------- |
| [`packages/cli`](packages/cli/README.md)           | 交互配置、项目管理及面向自动化的 JSON CLI |
| [`packages/mcp`](packages/mcp/README.md)           | MCP stdio server                          |
| [`packages/workflow`](packages/workflow/README.md) | CLI 与 MCP 共用工作流                     |
| [`packages/core`](packages/core/README.md)         | Git、配置、同步、采集和报告写入           |
| [`packages/shared`](packages/shared/README.md)     | 常量、Schema 和类型                       |
| `packages/typescript-config`                       | 共享 TypeScript 与 tsup 配置              |
| [`apps/desktop`](apps/desktop/README.md)           | Electron 配置、仓库与报告 GUI             |

标准 Agent Skill 位于 [`skills/weekly-git-report`](skills/weekly-git-report/SKILL.md)，不再作为独立 npm 包发布。

### 从旧命令迁移

CLI v4 将原 `@weekly-git-report/agent-cli` 合并到了 `@weekly-git-report/cli`：把包名替换为 `@weekly-git-report/cli`，并把全局命令 `weekly-agent` 替换为 `weekly`。原 `@weekly-git-report/skill` 安装器由 `npx skills add BINGWU2003/weekly-git-report` 取代。

## 本地开发

```sh
pnpm install
pnpm format:check
pnpm test
pnpm lint
pnpm check-types
pnpm build
```

代码检查、格式化和测试分别由 oxlint、oxfmt 与 Vitest 负责。

### VS Code

打开工作区后安装推荐扩展，即可在保存时使用 oxfmt 格式化，并在编辑器中查看 oxlint 和 Vitest 结果。

- 通过 `Tasks: Run Task` 执行单项检查或 `quality: verify all`。
- 按 `F5` 可调试交互式 CLI、项目列表、自动化采集、doctor 或当前 Vitest 测试文件。
- CLI 调试会先以单并发构建自身及内部依赖，并在集成终端中运行，以支持交互输入。

项目使用 Changesets 发布：`pnpm changeset`、`pnpm version-packages`、`pnpm release`。
