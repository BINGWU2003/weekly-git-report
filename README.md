# weekly-git-report

一个本地运行的 Git 周报工具集。它只处理你显式配置的仓库、分支和作者身份：采集前同步远程分支，将提交整理为结构化 Markdown，再交给 Agent 或 MCP 客户端生成并保存周报总结。

## 环境要求

- Node.js 20.19+
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
| Agent Skill | 希望直接在 Codex、Claude Code 或其他 Agent 中生成周报  | [`weekly-git-report`](skills/weekly-git-report/SKILL.md) |
| MCP         | 使用支持 MCP 的客户端，并希望通过 tools 编排采集与保存 | [`@weekly-git-report/mcp`](packages/mcp/README.md)       |
| CLI         | 交互配置，或由 Agent、脚本和 CI 使用稳定 JSON 命令     | [`@weekly-git-report/cli`](packages/cli/README.md)       |
| Electron    | 通过 GUI 初始化配置、维护仓库和浏览 Markdown 报告      | [`apps/desktop`](apps/desktop/README.md)                 |

#### Agent Skill

使用通用 Skills CLI 从仓库安装：

```sh
npx skills add BINGWU2003/weekly-git-report
```

重启客户端后，可以直接要求 Agent：

```text
根据 2026-08-18 到 2026-08-24 的 Git 提交生成周报并保存。
```

Skill 会指导 Agent 调用统一 CLI，完成同步、采集、读取 raw 和保存 summary。

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

以下命令形成一个完整的数据流程：

```sh
npx -y @weekly-git-report/cli@latest collect --since 2026-08-18 --until 2026-08-24 --all
npx -y @weekly-git-report/cli@latest raw read --start 2026-08-18 --end 2026-08-24
npx -y @weekly-git-report/cli@latest summary save --start 2026-08-18 --end 2026-08-24 --file ./weekly-summary.md
```

`collect` 会先同步选中的仓库，因此通常不需要提前执行 `projects sync`。命令成功后分别返回包含输出路径、raw 内容或 summary 路径的 JSON。

## 工作流程

一次采集会依次执行：

1. 从显式配置中选择已启用的项目。
2. 验证本地仓库的 `origin`。
3. fetch 配置的远程分支到 `refs/remotes/origin/{branch}`。
4. 从该远程引用读取指定日期范围内的提交，不依赖本地 `HEAD`。
5. 按命令行作者、项目作者或全局身份的优先级过滤提交。
6. 写入 raw 索引、manifest 和各项目 Markdown。
7. 由 Agent 或 MCP 客户端生成总结，并写入 summary 文件。

命令行传入的作者按完整姓名或完整邮箱匹配，不区分大小写。未传作者时，项目的 `authors` 优先于全局 `identities`。

单个项目同步或采集失败时，其他项目会继续处理，错误会进入结果的 `errors`，命令退出码为 `1`。失败项目不会回退到旧缓存来冒充最新结果。

Electron 仓库页和 `projects list/sync` JSON 会从本地缓存的 `refs/remotes/origin/{branch}` 读取采集分支最新提交；读取运行状态不会访问 GitLab、GitHub 或其他远程 API。

## 配置文件

全局配置位于 `~/.weekly-git-report/config.json`：

```json
{
  "outputRoot": "~/weekly-reports",
  "repositoryCacheRoot": "~/.weekly-git-report/repositories",
  "defaultSince": "last monday",
  "defaultUntil": "now",
  "includeEmptyProjects": false,
  "identities": [{ "name": "张三", "email": "zhangsan@example.com" }]
}
```

| 字段                           | 说明                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| `outputRoot`                   | raw 和 summary 的根目录                                       |
| `repositoryCacheRoot`          | 默认仓库缓存目录                                              |
| `defaultSince`、`defaultUntil` | Core API 的默认周期；当前 CLI 自动化命令和 MCP 仍要求显式日期 |
| `includeEmptyProjects`         | 是否为没有匹配提交的项目生成 raw 文件                         |
| `identities`                   | 默认 Git 作者身份，至少配置一个                               |

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
  repositories/

{outputRoot}/
  raw/{YYYY}/{MM}/{start}_{end}/
    index.md
    manifest.json
    {project}-{urlHash}.md
  summary/{YYYY}/{MM}/{start}_{end}.md
```

- `index.md`：本周期的项目索引。
- `manifest.json`：周期、项目文件、提交数量和错误等结构化元数据。
- `{project}-{urlHash}.md`：单个项目的提交记录。
- `summary/...md`：Agent 或 MCP 客户端生成的最终周报。

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
