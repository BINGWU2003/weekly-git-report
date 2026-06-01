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
weekly skill install --model opencode
weekly skill install --force
```

不传 `--target` / `--model` 时会交互选择目标；非 TTY 环境默认安装到 `opencode`。

支持的目标：

| Target | 写入位置 | 说明 |
| --- | --- | --- |
| `opencode` | `.opencode/skills/weekly-git-report/SKILL.md` | opencode 项目 Skill。 |
| `claude` | `.claude/skills/weekly-git-report/SKILL.md` | Claude Code 项目 Skill。 |
| `codex` | `AGENTS.md` | 写入带标记的 weekly-git-report 指令区块。 |

`--force` 会覆盖已有 Skill 文件；对 Codex 会替换 `AGENTS.md` 中已有的 weekly-git-report 标记区块。

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
