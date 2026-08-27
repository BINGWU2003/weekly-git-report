# @weekly-git-report/agent-cli

面向 Agent、脚本和 CI 的非交互 JSON CLI。它复用 weekly-git-report 的配置与工作流，通过 stdout 返回结构化结果。

## 环境要求

- Node.js 20.19+
- Git
- 已通过 [`@weekly-git-report/cli`](https://github.com/BINGWU2003/weekly-git-report/tree/main/packages/cli) 初始化配置并添加项目

首次使用前运行：

```sh
npx -y @weekly-git-report/cli@latest
```

## 快速开始

采集一个周期的提交，并读取生成的 raw：

```sh
npx -y @weekly-git-report/agent-cli@latest collect --since 2026-08-18 --until 2026-08-24 --all
npx -y @weekly-git-report/agent-cli@latest raw index --start 2026-08-18 --end 2026-08-24
npx -y @weekly-git-report/agent-cli@latest raw read --start 2026-08-18 --end 2026-08-24
```

`collect` 会自动同步选中的远程分支，并返回类似结果：

```json
{
  "outputDir": "/home/name/weekly-reports/raw/2026/08/2026-08-18_2026-08-24",
  "indexFile": "/home/name/weekly-reports/raw/2026/08/2026-08-18_2026-08-24/index.md",
  "manifestFile": "/home/name/weekly-reports/raw/2026/08/2026-08-18_2026-08-24/manifest.json",
  "projectCount": 2,
  "commitCount": 12,
  "errors": []
}
```

生成总结 Markdown 后，将其保存到配置的 `outputRoot`：

```sh
npx -y @weekly-git-report/agent-cli@latest summary save --start 2026-08-18 --end 2026-08-24 --file ./weekly-summary.md
```

成功结果包含 `summaryFile` 和写入的 `bytes`。

## 安装方式

一次性使用推荐 `npx`。也可以全局安装，此后使用 `weekly-agent`：

```sh
npm install -g @weekly-git-report/agent-cli
weekly-agent --help
```

## 命令

```text
weekly-agent projects list
weekly-agent projects sync [--project <id-or-name>] [--all]
weekly-agent collect --since <YYYY-MM-DD> --until <YYYY-MM-DD> [--author <name-or-email>] [--project <id-or-name>] [--all]
weekly-agent raw index --start <YYYY-MM-DD> --end <YYYY-MM-DD>
weekly-agent raw read --start <YYYY-MM-DD> --end <YYYY-MM-DD>
weekly-agent summary save --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--file <path>]
```

日期必须使用 `YYYY-MM-DD`。使用 `npx` 时，将 `weekly-agent` 替换为 `npx -y @weekly-git-report/agent-cli@latest`。

### `projects list`

读取全部显式项目，包括已禁用项目：

```sh
npx -y @weekly-git-report/agent-cli@latest projects list
```

结果中的项目包含 `id`、`name`、`path`、`remote`、`branch`、`enabled` 和可选 `authors`。

### `projects sync`

同步全部已启用项目：

```sh
npx -y @weekly-git-report/agent-cli@latest projects sync --all
```

同步指定项目；`--project` 可以重复：

```sh
npx -y @weekly-git-report/agent-cli@latest projects sync --project api --project web
```

不传 `--project` 与传入 `--all` 的效果相同。项目选择器按完整 ID 或完整名称匹配，且只能选择已启用项目；未知或已禁用项目会导致命令失败。

### `collect`

```sh
npx -y @weekly-git-report/agent-cli@latest collect --since 2026-08-18 --until 2026-08-24 --project api
```

`collect` 会先同步选中的项目，再从 `refs/remotes/origin/{branch}` 采集提交并写入 raw。无需额外执行 `projects sync`。

- `--project` 可重复，按完整项目 ID 或名称匹配。
- 不传 `--project` 与传入 `--all` 都会选择全部已启用项目。
- `--author` 可重复，按完整作者姓名或完整邮箱匹配，不区分大小写。
- 未传 `--author` 时，使用项目 `authors`，再回退到全局 `identities`。

例如同时匹配两个身份：

```sh
npx -y @weekly-git-report/agent-cli@latest collect --since 2026-08-18 --until 2026-08-24 --author "Zhang San" --author zhangsan@example.com --all
```

### `raw index` 与 `raw read`

```sh
npx -y @weekly-git-report/agent-cli@latest raw index --start 2026-08-18 --end 2026-08-24
npx -y @weekly-git-report/agent-cli@latest raw read --start 2026-08-18 --end 2026-08-24
```

`raw index` 返回 `{"content": "..."}`。`raw read` 只读取该周期 manifest 声明的项目 Markdown，返回 `{"files": [{"name": "...", "content": "..."}]}`。

### `summary save`

从文件读取 Markdown：

```sh
npx -y @weekly-git-report/agent-cli@latest summary save --start 2026-08-18 --end 2026-08-24 --file ./weekly-summary.md
```

不传 `--file` 时从 stdin 读取，适合 Agent 或 shell 管道：

```sh
cat ./weekly-summary.md | npx -y @weekly-git-report/agent-cli@latest summary save --start 2026-08-18 --end 2026-08-24
```

在 PowerShell 中可以使用：

```powershell
Get-Content -Raw ./weekly-summary.md | npx -y @weekly-git-report/agent-cli@latest summary save --start 2026-08-18 --end 2026-08-24
```

如果 stdin 是交互式终端且未传 `--file`，命令会报错。summary 始终写入配置的 `outputRoot/summary`，不能通过参数改写到其他位置。

## JSON 与退出码

- 成功结果写入 stdout，格式为缩进 JSON。
- 配置缺失、参数或日期校验失败、文件读取失败等命令级错误写入 stderr，退出码为 `1`。
- 单个项目同步或采集失败时，其他项目继续处理，失败详情进入 stdout JSON 的 `errors`。
- `errors` 非空本身不会把 Agent CLI 的退出码设为 `1`；自动化调用方应同时检查进程退出码和 JSON 中的 `errors`。

## 常见问题

### 提示配置不存在

在交互式终端运行 `npx -y @weekly-git-report/cli@latest init`。

### 项目显示在 list 中，但无法同步

`projects list` 包含已禁用项目，而 `projects sync` 和 `collect` 只处理 `enabled: true` 的项目。请通过交互式 CLI 编辑项目。

### raw 文件不存在

先使用完全相同的日期范围执行 `collect`。读取命令的 `start/end` 必须与采集命令的 `since/until` 对应。

完整配置和输出目录见[项目文档](https://github.com/BINGWU2003/weekly-git-report)。
