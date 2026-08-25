# weekly-git-report

一个本地 Node.js + TypeScript 工具集。用户显式配置 Git 仓库、分支和作者身份，工具在采集前自动同步远程分支，生成结构化 Markdown 原始记录，并由 Agent 或 MCP 保存周报总结。

## 环境要求

- Node.js 20.19+
- Git
- Windows、macOS 或 Linux

## 快速开始

### 1. 交互式配置

```sh
npx -y @weekly-git-report/cli@latest
```

`weekly` 菜单可以初始化全局配置，添加、编辑、删除、查看或同步仓库，以及运行环境检查。添加仓库时会询问：

- 仓库 URL
- 分支
- 仓库名称
- 本地缓存路径（留空使用默认值）
- 是否使用全局作者姓名和邮箱

仓库会以裸仓库形式缓存在本地，不检出源码。自定义路径也可以指向 remote 匹配的已有普通 Git 仓库。

### 2. Agent Skill 模式

```sh
npx -y @weekly-git-report/skill@latest install --target codex
```

安装后，Agent 按需执行：

```sh
npx -y @weekly-git-report/agent-cli@latest projects sync --all
npx -y @weekly-git-report/agent-cli@latest collect --since 2026-08-18 --until 2026-08-24 --all
npx -y @weekly-git-report/agent-cli@latest raw read --start 2026-08-18 --end 2026-08-24
```

`collect` 自身也会先同步选中的仓库，因此手动执行 `projects sync` 不是必需的。

### 3. MCP 模式

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

MCP 提供：`list_projects`、`sync_projects`、`collect_git_logs`、`get_week_index`、`read_week_raw`、`save_week_summary`。

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

项目可以通过 `authors` 覆盖全局身份。`localPath` 在添加项目时计算并保存；默认目录名包含 URL 短哈希，避免同名仓库冲突。

## 同步与采集

每次采集会依次：

1. 读取启用的显式项目。
2. 验证本地仓库的 `origin`。
3. fetch 配置的远程分支到 `refs/remotes/origin/{branch}`。
4. 从该远程引用读取指定周期提交，不依赖本地 HEAD。
5. 优先按命令行作者过滤，否则使用项目作者或全局身份邮箱。

单项目同步失败会进入报告的 `errors`，其他项目继续处理；失败项目不会使用旧缓存冒充最新结果。

## 数据目录

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

## Monorepo

| 包                           | 职责                            |
| ---------------------------- | ------------------------------- |
| `packages/cli`               | 交互式配置和项目管理            |
| `packages/agent-cli`         | 面向 Agent/脚本的 JSON CLI      |
| `packages/mcp`               | MCP stdio server                |
| `packages/skill`             | Agent Skill 安装器              |
| `packages/workflow`          | CLI 与 MCP 共用工作流           |
| `packages/core`              | Git、配置、同步、采集和报告写入 |
| `packages/shared`            | 常量、Schema 和类型             |
| `packages/typescript-config` | 共享 TypeScript 与 tsup 配置    |

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
- 按 `F5` 可调试交互式 CLI、项目列表、doctor、Agent CLI 或当前 Vitest 测试文件。
- CLI 调试会先以单并发构建自身及内部依赖，并在集成终端中运行，以支持交互输入。

项目使用 Changesets 发布：`pnpm changeset`、`pnpm version-packages`、`pnpm release`。
