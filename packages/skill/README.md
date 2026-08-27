# @weekly-git-report/skill

weekly-git-report Agent Skill 安装器。它把 npm 包内置的 `SKILL.md` 安装到当前项目，让 Codex、Claude Code 或 opencode 按需调用 [`@weekly-git-report/agent-cli`](https://github.com/BINGWU2003/weekly-git-report/tree/main/packages/agent-cli)，无需常驻 MCP server。

## 环境要求

- Node.js 20.19+
- 在希望写入 Skill 配置的项目根目录执行命令

所有目标路径都相对于命令执行时的当前工作目录。安装器从 npm 包内置文件读取模板，运行时不会从网络下载额外的 Skill 内容。

## 快速开始

进入目标项目并安装到对应客户端：

```sh
cd /path/to/your-project
npx -y @weekly-git-report/skill@latest install --target codex
```

首次使用 weekly-git-report 时，还需要初始化用户级配置并添加仓库：

```sh
npx -y @weekly-git-report/cli@latest
```

重启 Codex 后，可以在对话中提出：

```text
根据 2026-08-18 到 2026-08-24 的 Git 提交生成周报并保存。
```

Skill 会指导 Agent 同步项目、采集 raw、生成总结并保存 summary。

## 安装方式

直接运行包会进入安装流程：

```sh
npx -y @weekly-git-report/skill@latest
```

等价于：

```sh
npx -y @weekly-git-report/skill@latest install
```

在交互式终端中，安装器会询问目标客户端；在非 TTY 环境中，未指定 `--target` 时默认选择 `opencode`。自动化安装时建议始终显式传入 `--target`。

也可以全局安装，此后使用 `weekly-skill`：

```sh
npm install -g @weekly-git-report/skill
weekly-skill install --target codex
```

## 命令

### `weekly-skill install`

```text
weekly-skill install [--target <opencode|claude|codex|all>] [--force]
```

| 参数       | 类型                                 | 必填 | 默认值                         | 说明                      |
| ---------- | ------------------------------------ | ---- | ------------------------------ | ------------------------- |
| `--target` | `opencode \| claude \| codex \| all` | 否   | 交互选择；非 TTY 为 `opencode` | 目标 Agent 客户端         |
| `--force`  | boolean                              | 否   | `false`                        | 覆盖已经存在的 Skill 文件 |

### 帮助

`--help` 和 `-h` 是顶层参数，不是 `install` 的选项：

```sh
npx -y @weekly-git-report/skill@latest --help
```

当前不要使用 `install --help`；它会被识别为未知的安装选项。

## 安装目标

| Target     | 写入位置                                      | 安装后重启     |
| ---------- | --------------------------------------------- | -------------- |
| `opencode` | `.opencode/skills/weekly-git-report/SKILL.md` | opencode       |
| `claude`   | `.claude/skills/weekly-git-report/SKILL.md`   | Claude Code    |
| `codex`    | `.codex/skills/weekly-git-report/SKILL.md`    | Codex          |
| `all`      | 同时写入以上三个位置                          | 所有对应客户端 |

安装到全部支持的客户端：

```sh
npx -y @weekly-git-report/skill@latest install --target all
```

成功输出示例：

```text
Installed codex skill: D:\workspace\demo\.codex\skills\weekly-git-report\SKILL.md
Restart Codex to load the new skill.
└  Skill installed.
```

## 文件覆盖策略

默认使用安全的“不覆盖”写入：安装器会创建缺失的父目录，但如果目标 `SKILL.md` 已存在，命令会失败。

确认要替换现有文件后使用：

```sh
npx -y @weekly-git-report/skill@latest install --target codex --force
```

`--force` 只覆盖对应目标中的 `weekly-git-report/SKILL.md`。

## 安装后的工作流程

1. Agent 读取已安装的 `SKILL.md`。
2. Agent 通过 `@weekly-git-report/agent-cli` 查询并同步显式配置的项目。
3. Agent 采集指定周期的 Git 提交并读取 raw Markdown。
4. Agent 生成总结并保存到配置的 `outputRoot/summary`。

`collect` 自带同步步骤；Skill 不要求常驻服务，也不会修改客户端的全局 MCP 配置。

## 更新与卸载

更新 Skill 文件：

```sh
npx -y @weekly-git-report/skill@latest install --target codex --force
```

卸载时手动删除对应的 `weekly-git-report` 目录，例如：

```text
.codex/skills/weekly-git-report/
```

本包不提供自动卸载命令，也不会删除 weekly-git-report 的用户级配置或周报文件。

## 常见问题

### 文件已经存在

确认现有文件可以替换后增加 `--force`。如果文件包含本地定制，请先自行备份。

### 安装到了错误项目

安装位置以当前工作目录为基准。切换到正确的项目根目录后重新执行命令。

### 安装后没有生效

确认 `SKILL.md` 位于目标客户端要求的目录，并重启或重新加载对应客户端。

### `--target` 无效

只接受 `opencode`、`claude`、`codex` 或 `all`，不区分大小写。

### Agent 提示 weekly-git-report 配置不存在

Skill 文件与 weekly-git-report 用户配置彼此独立。请运行 `npx -y @weekly-git-report/cli@latest init` 初始化配置。

## 发布内容

- `dist`：`weekly-skill` 命令构建产物
- `skills/weekly-git-report/SKILL.md`：随 npm 包发布的 Agent Skill 模板
- `README.md`

项目整体用法见[项目文档](https://github.com/BINGWU2003/weekly-git-report)。
