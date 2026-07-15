# @weekly-git-report/agent-cli

面向 Agent 和自动化脚本的非交互 CLI。它按需扫描 Git 项目、采集原始记录、读取 raw，并保存周报总结；正常结果统一输出 JSON，不会常驻注册 MCP tools。

人手动初始化请使用 `@weekly-git-report/cli`，安装 Agent Skill 请使用 `@weekly-git-report/skill`。

## 环境要求

- Node.js 18 或更高版本
- 本机已安装 Git
- 执行采集前已经运行 `weekly init` 和项目扫描

## 快速开始

```sh
npx -y @weekly-git-report/cli@latest init
npx -y @weekly-git-report/agent-cli@latest projects scan
npx -y @weekly-git-report/agent-cli@latest collect --since 2026-06-01 --until 2026-06-07 --all
npx -y @weekly-git-report/agent-cli@latest raw read --start 2026-06-01 --end 2026-06-07
```

以下示例使用全局命令名 `weekly-agent`。使用 `npx` 时，将它替换为：

```sh
npx -y @weekly-git-report/agent-cli@latest
```

## 命令总览

```text
weekly-agent projects list
weekly-agent projects scan [--root <path>] [--max-depth <number>]
weekly-agent collect --since <YYYY-MM-DD> --until <YYYY-MM-DD> [--author <name>] [--project <id>] [--all]
weekly-agent raw index --start <YYYY-MM-DD> --end <YYYY-MM-DD>
weekly-agent raw read --start <YYYY-MM-DD> --end <YYYY-MM-DD>
weekly-agent summary save --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--file <path>]
```

日期参数必须使用 `YYYY-MM-DD` 格式。

## 项目命令

### `projects scan`

扫描 Git 项目并更新 `~/.weekly-git-report/projects.json`。

```sh
weekly-agent projects scan
weekly-agent projects scan --root E:/workspace --root D:/projects
weekly-agent projects scan --max-depth 6
```

| 参数          | 类型   | 必填 | 默认值              | 可重复 | 说明                                   |
| ------------- | ------ | ---- | ------------------- | ------ | -------------------------------------- |
| `--root`      | string | 否   | 配置中的 `roots`    | 是     | 本次扫描的根目录；传入后覆盖配置 roots |
| `--max-depth` | 正整数 | 否   | 配置中的 `maxDepth` | 否     | 最大递归深度                           |

返回示例：

```json
{
  "projectCount": 3,
  "projectsFile": "C:/Users/name/.weekly-git-report/projects.json",
  "warnings": []
}
```

### `projects list`

读取已经生成的项目索引。

```sh
weekly-agent projects list
```

返回示例：

```json
{
  "projects": [
    {
      "id": "github.com/acme/order-service",
      "name": "order-service",
      "path": "E:/workspace/order-service",
      "remote": "git@github.com:acme/order-service.git",
      "branch": "main"
    }
  ]
}
```

## 采集命令

### `collect`

采集指定周期内的 Git commit，并写入 `{outputRoot}/raw`。

```sh
weekly-agent collect --since 2026-06-01 --until 2026-06-07 --all
weekly-agent collect --since 2026-06-01 --until 2026-06-07 --author "张三"
weekly-agent collect --since 2026-06-01 --until 2026-06-07 --project order-service
```

| 参数        | 类型         | 必填 | 默认值                                         | 可重复 | 说明                       |
| ----------- | ------------ | ---- | ---------------------------------------------- | ------ | -------------------------- |
| `--since`   | `YYYY-MM-DD` | 是   | -                                              | 否     | 采集开始日期               |
| `--until`   | `YYYY-MM-DD` | 是   | -                                              | 否     | 采集结束日期               |
| `--author`  | string       | 否   | 配置 `author`，再回退到 `git config user.name` | 是     | Git 作者名称               |
| `--project` | string       | 否   | 全部项目                                       | 是     | 项目 `id` 或 `name`        |
| `--all`     | boolean      | 否   | 未指定项目时等价于全部                         | 否     | 清空项目筛选并采集全部项目 |

多个作者和项目可以重复传入：

```sh
weekly-agent collect \
  --since 2026-06-01 \
  --until 2026-06-07 \
  --author "张三" \
  --author "李四" \
  --project order-service \
  --project web-console
```

返回示例：

```json
{
  "outputDir": "D:/weekly-reports/raw/2026/06/2026-06-01_2026-06-07",
  "indexFile": "D:/weekly-reports/raw/2026/06/2026-06-01_2026-06-07/index.md",
  "manifestFile": "D:/weekly-reports/raw/2026/06/2026-06-01_2026-06-07/manifest.json",
  "projectCount": 3,
  "commitCount": 16,
  "errors": []
}
```

单个项目失败会记录在 `errors` 中，不会丢弃其他项目的成功结果。

## Raw 读取命令

### `raw index`

读取指定周期的 `index.md`：

```sh
weekly-agent raw index --start 2026-06-01 --end 2026-06-07
```

| 参数      | 类型         | 必填 | 说明         |
| --------- | ------------ | ---- | ------------ |
| `--start` | `YYYY-MM-DD` | 是   | 周期开始日期 |
| `--end`   | `YYYY-MM-DD` | 是   | 周期结束日期 |

返回结构：

```json
{
  "content": "# Git 周报原始记录\n..."
}
```

### `raw read`

根据 `manifest.json` 读取指定周期内的项目 Markdown，不包含 `index.md` 或清单外文件。

```sh
weekly-agent raw read --start 2026-06-01 --end 2026-06-07
```

返回示例：

```json
{
  "files": [
    {
      "name": "order-service.md",
      "content": "# order-service\n..."
    }
  ]
}
```

## Summary 保存命令

### `summary save`

保存 Markdown 总结到 `{outputRoot}/summary/{YYYY}/{MM}/{start}_{end}.md`。

从文件读取内容：

```sh
weekly-agent summary save \
  --start 2026-06-01 \
  --end 2026-06-07 \
  --file summary.md
```

| 参数      | 类型         | 必填 | 说明                                 |
| --------- | ------------ | ---- | ------------------------------------ |
| `--start` | `YYYY-MM-DD` | 是   | 周期开始日期                         |
| `--end`   | `YYYY-MM-DD` | 是   | 周期结束日期                         |
| `--file`  | 文件路径     | 否   | Markdown 来源；未提供时从 stdin 读取 |

通过 stdin 保存：

```sh
printf '# 周报总结\n\n- 完成项目发布。\n' | weekly-agent summary save --start 2026-06-01 --end 2026-06-07
```

PowerShell：

```powershell
Get-Content -Raw summary.md | weekly-agent summary save --start 2026-06-01 --end 2026-06-07
```

返回示例：

```json
{
  "summaryFile": "D:/weekly-reports/summary/2026/06/2026-06-01_2026-06-07.md",
  "bytes": 1280
}
```

文件末尾缺少换行时会自动补一个换行。相同周期再次保存会覆盖同一文件。

## 输出与退出码

- 成功结果写入 stdout，格式为带缩进的 JSON。
- 可预期错误写入 stderr，并设置退出码 `1`。
- 配置不存在时会提示执行 `weekly init`。
- 项目索引不存在时会提示执行 `weekly-agent projects scan`。
- `summary save` 未提供 `--file` 且没有管道输入时会失败。

脚本中可以直接解析 stdout：

```sh
weekly-agent projects list | jq '.projects[].name'
```

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

## Skill 安装

```sh
npx -y @weekly-git-report/skill@latest
```

## 依赖关系

本包复用私有的 `@weekly-git-report/workflow`、`core` 和 `shared` 包。发布时这些内部逻辑会被打包进 `dist`，用户不需要单独安装。
