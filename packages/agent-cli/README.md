# @weekly-git-report/agent-cli

给 Agent Skill 按需调用的非交互 CLI。它不会常驻注册 MCP tools，适合只在生成周报时通过 `npx` 临时执行。

这个包面向 Agent，不面向人日常操作。人手动初始化和安装 Skill 请使用 `@weekly-git-report/cli`。

## 使用

```sh
npx -y @weekly-git-report/agent-cli@latest --help
npx -y @weekly-git-report/agent-cli@latest collect --since 2026-06-01 --until 2026-06-07 --all
npx -y @weekly-git-report/agent-cli@latest raw read --start 2026-06-01 --end 2026-06-07
npx -y @weekly-git-report/agent-cli@latest summary save --start 2026-06-01 --end 2026-06-07 --file summary.md
```

## 命令

### `weekly-agent projects list`

输出已扫描项目列表，JSON 格式。

```sh
npx -y @weekly-git-report/agent-cli@latest projects list
```

### `weekly-agent projects scan`

扫描项目并更新项目索引，JSON 格式输出结果。

```sh
npx -y @weekly-git-report/agent-cli@latest projects scan --root E:/workspace/project
```

### `weekly-agent collect`

采集 Git commit 并生成 raw 文件，JSON 格式输出生成路径。

```sh
npx -y @weekly-git-report/agent-cli@latest collect --since 2026-06-01 --until 2026-06-07 --all
```

### `weekly-agent raw index`

读取指定周期 raw 索引。

```sh
npx -y @weekly-git-report/agent-cli@latest raw index --start 2026-06-01 --end 2026-06-07
```

### `weekly-agent raw read`

读取指定周期所有项目 Markdown 原始记录。

```sh
npx -y @weekly-git-report/agent-cli@latest raw read --start 2026-06-01 --end 2026-06-07
```

### `weekly-agent summary save`

保存 Agent 生成的 summary。推荐通过文件传入 Markdown：

```sh
npx -y @weekly-git-report/agent-cli@latest summary save --start 2026-06-01 --end 2026-06-07 --file summary.md
```

也支持从 stdin 读取：

```sh
npx -y @weekly-git-report/agent-cli@latest summary save --start 2026-06-01 --end 2026-06-07 < summary.md
```

输出文件：

```text
{outputRoot}/summary/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}.md
```

Skill 安装由 `@weekly-git-report/cli` 负责：

```sh
npx -y @weekly-git-report/cli@latest skill install
```

## 输出格式

所有命令都尽量输出稳定 JSON，方便 Agent 解析。错误会写入 stderr，并设置非零退出码。

## 依赖关系

`@weekly-git-report/agent-cli` 依赖私有包 `@weekly-git-report/workflow`。发布时 workflow 会被打包进 `dist`，用户不需要单独安装 workflow。
