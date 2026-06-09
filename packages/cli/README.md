# @weekly-git-report/cli

面向使用者的主 CLI，提供本地初始化、项目扫描、提交采集和 Agent Skill 安装能力。

这个包适合人手动执行。Agent 自动化执行请使用 `@weekly-git-report/agent-cli`。

## 安装

```sh
npm install -g @weekly-git-report/cli
```

也可以通过 `npx` 临时执行：

```sh
npx -y @weekly-git-report/cli@latest --help
```

## 使用

```sh
weekly init
weekly scan --root E:/workspace/project
weekly list
weekly collect --since 2026-06-01 --until 2026-06-07
weekly skill install --target opencode
```

`weekly init` 会交互式询问项目扫描根目录 `roots` 和周报输出目录 `outputRoot`。多个 `roots` 目录用 `，` 隔开，直接回车会使用默认值。

CLI 会将配置保存到 `~/.weekly-git-report/config.json`，并将周报原始记录写入配置中的 `outputRoot`。

## 配置文件

### `~/.weekly-git-report/config.json`

`weekly init` 会创建本地配置文件。示例：

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

字段说明：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `roots` | `string[]` | `['~/work', '~/Code', '~/Projects']` | `weekly scan` 默认扫描的根目录，至少需要一个目录。支持 `~` 表示用户主目录。 |
| `excludeDirs` | `string[]` | `['node_modules', '.cache', 'dist', 'build', 'vendor', 'tmp']` | 扫描时跳过的目录名，只按目录名匹配，不需要写完整路径。 |
| `maxDepth` | `number` | `5` | 扫描 Git 项目的最大递归深度，必须是正整数；`weekly scan --max-depth` 会覆盖本次扫描的值。 |
| `outputRoot` | `string` | `'~/weekly-reports'` | raw、summary 输出根目录。支持 `~`、相对路径和绝对路径；Windows 路径建议写成 `D:/files`。 |
| `author` | `string[]` | `[]` | 默认采集的 Git 作者；`weekly collect --author` 优先级更高。为空时使用当前目录的 `git config user.name`；兼容字符串写法。 |
| `defaultSince` | `string` | `'last monday'` | 不传 `weekly collect --since` 时使用的开始日期。支持 `YYYY-MM-DD` 或 `last monday`。 |
| `defaultUntil` | `string` | `'now'` | 不传 `weekly collect --until` 时使用的结束日期。支持 `YYYY-MM-DD` 或 `now`。 |
| `includeEmptyProjects` | `boolean` | `false` | 是否为没有匹配 commit 的项目生成 raw 项目文件。 |

### `~/.weekly-git-report/projects.json`

`weekly scan` 会生成项目索引文件。示例：

```json
{
  "version": 1,
  "generatedAt": "2026-06-09T01:00:00.000Z",
  "projects": [
    {
      "id": "github.com/acme/order-service",
      "name": "order-service",
      "fileName": "order-service.md",
      "path": "D:/workspace/order-service",
      "remote": "git@github.com:acme/order-service.git",
      "branch": "main",
      "lastCommitAt": "2026-06-08T10:30:00+08:00",
      "isDuplicate": false
    }
  ]
}
```

顶层字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `version` | `1` | 项目索引格式版本，当前固定为 `1`。 |
| `generatedAt` | `string` | 索引生成时间，ISO 时间字符串。 |
| `projects` | `Project[]` | 扫描到的 Git 项目列表。 |

`projects` 项字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 项目唯一标识。有 `origin` remote 时由 remote 规范化得到；没有 remote 时使用项目路径。`weekly collect --project` 可传 `id` 或 `name`。 |
| `name` | `string` | 项目目录名。 |
| `fileName` | `string` | 采集 raw 时写入的 Markdown 文件名，由项目名清洗非法文件名字符后生成。 |
| `path` | `string` | 本地 Git 项目绝对路径。 |
| `remote` | `string` | 可选，`origin` remote URL。 |
| `branch` | `string` | 可选，扫描时的当前分支名。 |
| `lastCommitAt` | `string` | 可选，最近一次 commit 时间，来自 `git log -1 --format=%cI`。 |
| `isDuplicate` | `boolean` | 重复项目标记，当前扫描会按 `id` 去重，保留最近活跃的路径，写入的项目通常为 `false`。 |

`projects.json` 由 `weekly scan` 维护，重新扫描会更新该文件。

## 命令

### `weekly init`

初始化本地工作目录和配置：

```text
~/.weekly-git-report/config.json
```

同时创建 `outputRoot/raw` 和 `outputRoot/summary`。

### `weekly scan`

扫描 Git 项目并写入项目索引：

```sh
weekly scan
weekly scan --root ~/work --root ~/Code
weekly scan --max-depth 6
```

输出文件：

```text
~/.weekly-git-report/projects.json
```

### `weekly list`

列出已扫描项目的名称、分支和 remote。

### `weekly collect`

采集指定周期 Git commit 并写入 raw 目录：

```sh
weekly collect --since 2026-06-01 --until 2026-06-07
weekly collect --author "张三" --author "李四"
weekly collect --project order-service
weekly collect --all
weekly collect --backup
```

输出目录：

```text
{outputRoot}/raw/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}/
```

### `weekly skill install`

把 Agent Skill 安装到当前项目：

```sh
weekly skill install
weekly skill install --target opencode
weekly skill install --target claude
weekly skill install --target codex
weekly skill install --target all
weekly skill install --force
```

不传 `--target` 时会交互选择目标；非 TTY 环境默认安装到 `opencode`。

支持的目标：

| Target | 写入位置 | 说明 |
| --- | --- | --- |
| `opencode` | `.opencode/skills/weekly-git-report/SKILL.md` | opencode 项目 Skill。 |
| `claude` | `.claude/skills/weekly-git-report/SKILL.md` | Claude Code 项目 Skill。 |
| `codex` | `.codex/skills/weekly-git-report/SKILL.md` | Codex 项目 Skill。 |
| `all` | 以上全部位置 | 同时安装 opencode、Claude Code 和 Codex。 |

`--force` 会覆盖已有 Skill 文件。

opencode 安装位置：

```text
.opencode/skills/weekly-git-report/SKILL.md
```

安装后需要重启对应 Agent 客户端。

## 发布内容

npm 包包含：

- `dist`：CLI 构建产物。
- `skills/weekly-git-report/SKILL.md`：Agent Skill 模板。
- `README.md`。

## 依赖关系

`@weekly-git-report/cli` 直接调用 `@weekly-git-report/core`，用于初始化、扫描、采集和写入 raw。它不依赖 `@weekly-git-report/agent-cli`，Skill 只是通过模板中的 `npx` 命令按需调用 agent CLI。
