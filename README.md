# weekly-git-report

`weekly-git-report` 是一个本地 Node.js + TypeScript 工具集，用于扫描多个 Git 项目，采集指定周期内的 commit 记录，并生成结构化 Markdown 原始记录和可保存的周报总结。

项目提供三种入口：面向人的 `weekly` CLI、面向 MCP Client 的 stdio server、面向 Agent Skill 按需调用的 `weekly-agent` CLI。

## 当前状态

当前版本已满足本项目现阶段使用需求，功能范围覆盖 CLI、MCP Server、Agent CLI 和 opencode Skill 模板。

原计划中的阶段 8 稳定性增强暂不继续推进。后续如有实际使用中的问题，再按具体问题单独迭代。

## 已实现能力

- `weekly init`：初始化本地配置。
- `weekly scan`：扫描 Git 项目并生成项目索引。
- `weekly list`：查看已扫描项目列表。
- `weekly collect`：采集 commit 并生成 Markdown、`index.md`、`manifest.json`。
- 支持通过 `config.json` 的 `outputRoot` 自定义原始记录输出目录。
- 支持重复采集同一项目、同一周期时幂等处理。
- 支持 MCP tool 保存 summary 到 `outputRoot/summary`。
- 支持通过 Skill + Agent CLI 按需生成和保存周报总结，避免 MCP tools 常驻占用上下文。
- 使用 Zod 校验配置、项目索引、采集参数和 manifest。

## 架构分层

```text
@weekly-git-report/cli
  -> @weekly-git-report/core

@weekly-git-report/mcp-server
  -> @weekly-git-report/workflow
  -> @weekly-git-report/core

@weekly-git-report/agent-cli
  -> @weekly-git-report/workflow
  -> @weekly-git-report/core

@weekly-git-report/shared
  -> schemas / constants / types
```

分层原则：

- `cli` 负责人手动初始化、扫描、采集和安装 Skill。
- `agent-cli` 只提供 Agent 按需调用的非交互 JSON 命令。
- `mcp-server` 只负责 MCP 工具注册和 stdio 入口。
- `workflow` 统一封装 MCP 与 Agent CLI 共用的业务流程。
- `core` 负责 Git、文件、路径、配置和 raw 写入等底层能力。
- `shared` 负责常量、schema 和类型。

## 目录说明

工具工作目录固定为：

```text
~/.weekly-git-report/
```

初始化后包含：

```text
~/.weekly-git-report/
  config.json
  projects.json
```

默认周报原始记录输出目录为：

```text
~/weekly-reports/
```

采集后生成：

```text
~/weekly-reports/raw/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}/
  index.md
  manifest.json
  {project}.md
```

总结保存后生成：

```text
~/weekly-reports/summary/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}.md
```

## 推荐使用方式

### 人手动使用 CLI

```sh
npm install -g @weekly-git-report/cli
weekly init
weekly scan --root E:/workspace/project
weekly collect --since 2026-06-01 --until 2026-06-07
```

### Agent Skill 按需模式

适合不想常驻加载 MCP tools 的场景。

```sh
npx -y @weekly-git-report/cli@latest skill install
```

安装后重启 opencode。之后当用户要求生成周报时，Skill 会指导 Agent 通过 `@weekly-git-report/agent-cli` 临时采集 raw、读取 raw 并保存 summary。

### MCP 常驻模式

适合希望 Agent 直接调用 MCP tools 的场景。

```json
{
  "mcpServers": {
    "weekly-git-report": {
      "command": "npx",
      "args": ["-y", "@weekly-git-report/mcp-server@latest"]
    }
  }
}
```

## 开发命令

```sh
pnpm install
pnpm lint
pnpm check-types
pnpm build
```

单包调试示例：

```sh
pnpm --filter @weekly-git-report/cli build
pnpm --filter @weekly-git-report/agent-cli check-types
pnpm --filter @weekly-git-report/mcp-server lint
```

## 发布说明

本仓库准备发布三个 npm 包：

- `@weekly-git-report/cli`：提供 `weekly` 命令。
- `@weekly-git-report/mcp-server`：提供 `weekly-git-report-mcp` 命令。
- `@weekly-git-report/agent-cli`：提供 `weekly-agent` 命令，给 Agent Skill 按需调用。

发包前建议执行完整检查：

```sh
pnpm install
pnpm lint
pnpm check-types
pnpm build
```

构建产物由 `tsup` 生成到各包的 `dist/` 目录。
`@weekly-git-report/core`、`@weekly-git-report/shared` 和 `@weekly-git-report/workflow` 是内部包，不单独发布，会被打进公开包的构建产物。

### 包与命令

| 包名                            | 目录                  | bin                     | 用途               |
| ------------------------------- | --------------------- | ----------------------- | ------------------ |
| `@weekly-git-report/cli`        | `packages/cli`        | `weekly`                | CLI 扫描与采集工具 |
| `@weekly-git-report/mcp-server` | `packages/mcp-server` | `weekly-git-report-mcp` | MCP stdio server   |
| `@weekly-git-report/agent-cli`  | `packages/agent-cli`  | `weekly-agent`          | Agent 按需调用 CLI |

CLI 构建产物：

```text
packages/cli/dist/index.js
```

MCP Server 构建产物：

```text
packages/mcp-server/dist/index.js
```

Agent CLI 构建产物：

```text
packages/agent-cli/dist/index.js
```

### 发布命令

本项目使用 Changesets 管理版本和发布。

添加变更集：

```sh
pnpm changeset
```

更新版本号和 changelog：

```sh
pnpm version-packages
```

发布公开包：

```sh
pnpm release
```

手动发布前需要在当前终端设置 npm token。项目 `.npmrc` 使用 `NPM_TOKEN` 环境变量，不保存明文 token：

```sh
export NPM_TOKEN=your-npm-token
pnpm release
```

Windows PowerShell：

```powershell
$env:NPM_TOKEN="your-npm-token"
pnpm release
```

Changesets 配置只发布以下公开包：

- `@weekly-git-report/cli`
- `@weekly-git-report/mcp-server`
- `@weekly-git-report/agent-cli`

以下包会被忽略，不会发布：

- `@weekly-git-report/core`
- `@weekly-git-report/shared`
- `@weekly-git-report/workflow`
- `@weekly-git-report/eslint-config`
- `@weekly-git-report/typescript-config`

如果只在公司私有 npm 源内发布，按私有源策略调整 registry 配置。

### 安装方式

CLI 建议全局安装，提供 `weekly` 命令：

```sh
npm install -g @weekly-git-report/cli
```

MCP Server 不需要全局安装，推荐在 MCP Client 配置中通过 `npx` 按需安装和启动。

Agent Skill 不需要 MCP 常驻，推荐通过 `weekly-agent` 按需调用：

```sh
npx -y @weekly-git-report/cli@latest skill install
```

安装后重启 opencode，让 Skill 生效。

安装后可用 CLI 命令：

```sh
weekly --help
```

如果只想临时验证 MCP Server 能否启动，可以运行：

```sh
npx -y @weekly-git-report/mcp-server@latest
```

也可以指定固定版本，避免自动使用最新版本：

```sh
npx -y @weekly-git-report/mcp-server@1.0.0
```

## CLI 使用

开发环境可以直接通过 Node 运行 CLI 构建产物：

```sh
pnpm build
node packages/cli/dist/index.js --help
```

发布并安装 `@weekly-git-report/cli` 后，命令名为：

```sh
weekly
```

全局安装后，使用方式为：

```sh
weekly --help
weekly init
weekly scan
weekly list
weekly collect
```

### 初始化

```sh
weekly init
```

作用：

- 创建 `~/.weekly-git-report/`。
- 创建默认 `config.json`。
- 创建默认输出目录 `~/weekly-reports/raw` 和 `~/weekly-reports/summary`。
- 如果配置文件已存在，不会覆盖。

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

### 扫描项目

```sh
weekly scan
weekly scan --root ~/work --root ~/Code
weekly scan --max-depth 6
```

扫描会递归查找包含 `.git` 目录或 `.git` 文件的 Git 项目，并生成：

```text
~/.weekly-git-report/projects.json
```

扫描时会读取每个项目的 remote、branch 和最近提交时间。同一个 remote 对应多个本地路径时，保留最近活跃的项目。

### 查看项目列表

```sh
weekly list
```

输出项目名、分支和 remote。

### 采集 Git 提交记录

```sh
weekly collect
weekly collect --since 2026-06-01 --until 2026-06-07
weekly collect --author "张三"
weekly collect --author "张三" --author "李四"
weekly collect --project order-service
weekly collect --all
weekly collect --backup
```

author 优先级：

```text
CLI 参数 author > config.json author > git config user.name
```

`author` 支持多个作者。配置文件中可以写成数组：

```json
{
  "author": ["张三", "李四"]
}
```

CLI 中可以重复传入 `--author`，会同时采集这些作者的提交。
为兼容旧配置，`"author": "张三"` 仍会被解析为 `["张三"]`。

采集完成后输出示例：

```text
Generated:
~/weekly-reports/raw/2026/06/2026-06-01_2026-06-07

Projects: 3
Commits: 16
Updated files: 3
Skipped files: 0
Errors: 0
```

## 自定义输出目录

编辑：

```text
~/.weekly-git-report/config.json
```

修改：

```json
{
  "outputRoot": "~/Documents/company-weekly-reports"
}
```

Windows 下也可以直接配置到 D 盘或 E 盘，建议使用 `/` 避免 JSON 反斜杠转义：

```json
{
  "outputRoot": "D:/files"
}
```

如果使用反斜杠，需要写成双反斜杠：

```json
{
  "outputRoot": "D:\\files"
}
```

之后执行：

```sh
weekly collect --since 2026-06-01 --until 2026-06-07
```

结果会写入：

```text
~/Documents/company-weekly-reports/raw/2026/06/2026-06-01_2026-06-07/
```

不会写入默认目录，除非 `outputRoot` 本身就是默认路径。

## MCP Server

开发环境可以直接通过 Node 启动 MCP Server 构建产物：

```sh
node packages/mcp-server/dist/index.js
```

发布到 npm 后，推荐通过 `npx` 按需启动，不需要全局安装：

```sh
npx -y @weekly-git-report/mcp-server@latest
```

### MCP Client 配置

如果 MCP Client 支持 stdio server，可以按下面方式配置。

开发环境使用本地构建产物：

```json
{
  "mcpServers": {
    "weekly-git-report": {
      "command": "node",
      "args": [
        "D:/files/hjc-code/weekly-git-report/packages/mcp-server/dist/index.js"
      ]
    }
  }
}
```

发布到 npm 后，推荐让 MCP Client 通过 `npx` 自动安装并启动：

```json
{
  "mcpServers": {
    "weekly-git-report": {
      "command": "npx",
      "args": ["-y", "@weekly-git-report/mcp-server@latest"]
    }
  }
}
```

如需固定版本，将 `@latest` 改成具体版本，例如 `@weekly-git-report/mcp-server@1.0.0`。

### MCP 使用前准备

MCP Server 复用 CLI 生成的本地配置和项目索引。首次使用前先执行：

```sh
weekly init
weekly scan --root E:/workspace/project
```

如果需要把原始记录输出到 D 盘，编辑：

```text
~/.weekly-git-report/config.json
```

设置：

```json
{
  "roots": ["E:/workspace/project"],
  "outputRoot": "D:/files",
  "author": []
}
```

之后 MCP 的 `collect_git_logs` 会把结果写入：

```text
D:/files/raw/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}/
```

MCP 的 `save_week_summary` 会把总结写入：

```text
D:/files/summary/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}.md
```

已提供工具：

- `list_projects`：列出已扫描 Git 项目。
- `scan_projects`：扫描项目并更新项目索引。
- `collect_git_logs`：采集 Git 提交记录并写入原始记录文件。
- `get_week_index`：读取指定周期的 `index.md`。
- `read_week_raw`：读取指定周期所有项目 Markdown 原始记录。
- `save_week_summary`：保存指定周期的周报总结 Markdown 到 `summary` 目录。

MCP 读取原始记录时只允许访问 `config.json` 中 `outputRoot` 下的文件。

### MCP 工具参数示例

`collect_git_logs`：

```json
{
  "since": "2026-06-01",
  "until": "2026-06-07",
  "author": ["张三", "李四"],
  "projectIds": []
}
```

`get_week_index`：

```json
{
  "start": "2026-06-01",
  "end": "2026-06-07"
}
```

`read_week_raw`：

```json
{
  "start": "2026-06-01",
  "end": "2026-06-07"
}
```

`save_week_summary`：

```json
{
  "start": "2026-06-01",
  "end": "2026-06-07",
  "content": "# 周报总结\n\n- 完成 Git 提交记录采集和整理。"
}
```

## Agent Skill 按需模式

如果不想常驻加载 MCP tools，可以使用 Agent Skill 按需模式。

在目标项目中安装 Skill：

```sh
npx -y @weekly-git-report/cli@latest skill install
```

这会创建：

```text
.opencode/skills/weekly-git-report/SKILL.md
```

Skill 触发后会指导 Agent 通过 `weekly-agent` 临时命令采集、读取 raw 并保存 summary，不需要配置 MCP。

常用命令：

```sh
npx -y @weekly-git-report/agent-cli@latest collect --since 2026-06-01 --until 2026-06-07 --all
npx -y @weekly-git-report/agent-cli@latest raw read --start 2026-06-01 --end 2026-06-07
npx -y @weekly-git-report/agent-cli@latest summary save --start 2026-06-01 --end 2026-06-07 --file summary.md
```

## 幂等策略

- 同一项目和同一周期始终写入同一个 Markdown 文件。
- 默认覆盖模式，禁止追加写入。
- 不生成 `-1`、`-copy`、`-new` 这类重复文件。
- 每个项目 Markdown 会计算 `contentHash`。
- `generatedAt` 和“采集时间”不参与 `contentHash`。
- 如果内容未变化，重复采集会跳过项目 Markdown 写入。

## Monorepo 包

| 包 | 发布 | 职责 |
| --- | --- | --- |
| `packages/cli` | 是 | 面向人的 `weekly` CLI，负责 init、scan、collect、skill install。 |
| `packages/agent-cli` | 是 | 面向 Agent Skill 的 `weekly-agent` 非交互 CLI，输出稳定 JSON。 |
| `packages/mcp-server` | 是 | MCP stdio server，暴露项目扫描、raw 读取和 summary 保存工具。 |
| `packages/workflow` | 否 | MCP 与 Agent CLI 共用的业务流程层。 |
| `packages/core` | 否 | 配置、路径、Git、扫描、采集、写入逻辑。 |
| `packages/shared` | 否 | 常量、Zod schemas、类型。 |
| `packages/eslint-config` | 否 | 共享 ESLint flat config。 |
| `packages/typescript-config` | 否 | 共享 TypeScript 和 tsup 配置。 |

每个子包目录下都有独立 README，说明该包的职责、使用方式和依赖关系。
