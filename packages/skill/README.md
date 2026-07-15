# @weekly-git-report/skill

用于拉取并安装 weekly-git-report Agent Skill 的独立包。安装后的 Skill 会指导 Agent 按需调用 `@weekly-git-report/agent-cli`，不需要常驻 MCP tools。

## 环境要求

- Node.js 18 或更高版本
- 在希望写入 Skill 配置的项目根目录执行命令

所有安装路径都相对于命令执行时的当前工作目录。

## 快速开始

直接运行包会进入安装流程：

```sh
cd /path/to/your-project
npx -y @weekly-git-report/skill@latest
```

它等价于：

```sh
npx -y @weekly-git-report/skill@latest install
```

交互终端会询问目标客户端；非 TTY 环境默认选择 `opencode`。

## 命令

### `weekly-skill install`

全局安装后可以使用：

```sh
npm install -g @weekly-git-report/skill
weekly-skill install
```

通常更推荐使用无需全局安装的 `npx`：

```sh
npx -y @weekly-git-report/skill@latest install [options]
```

| 参数           | 类型                                 | 必填 | 默认值                         | 说明                      |
| -------------- | ------------------------------------ | ---- | ------------------------------ | ------------------------- |
| `--target`     | `opencode \| claude \| codex \| all` | 否   | 交互选择；非 TTY 为 `opencode` | 目标 Agent 客户端         |
| `--force`      | boolean                              | 否   | `false`                        | 覆盖已经存在的 Skill 文件 |
| `--help`、`-h` | boolean                              | 否   | -                              | 显示帮助                  |

## 安装目标

| Target     | 写入位置                                      | 重启客户端     |
| ---------- | --------------------------------------------- | -------------- |
| `opencode` | `.opencode/skills/weekly-git-report/SKILL.md` | opencode       |
| `claude`   | `.claude/skills/weekly-git-report/SKILL.md`   | Claude Code    |
| `codex`    | `.codex/skills/weekly-git-report/SKILL.md`    | Codex          |
| `all`      | 同时写入以上三个位置                          | 所有对应客户端 |

## 使用示例

安装到 Codex：

```sh
npx -y @weekly-git-report/skill@latest install --target codex
```

安装到全部支持的客户端：

```sh
npx -y @weekly-git-report/skill@latest install --target all
```

覆盖已有文件：

```sh
npx -y @weekly-git-report/skill@latest install --target codex --force
```

成功输出示例：

```text
Installed codex skill: D:\workspace\demo\.codex\skills\weekly-git-report\SKILL.md
Restart Codex to load the new skill.
└  Skill installed.
```

## 安装后的使用流程

1. 重启对应 Agent 客户端。
2. 在对话中要求 Agent 根据 Git 提交生成周报。
3. Skill 会按需执行 `@weekly-git-report/agent-cli`，扫描项目、采集 raw、生成总结并保存 summary。

首次使用前需要初始化 weekly-git-report 配置：

```sh
npx -y @weekly-git-report/cli@latest init
```

## 更新与卸载

更新 Skill 文件：

```sh
npx -y @weekly-git-report/skill@latest install --target codex --force
```

卸载时删除对应的 `weekly-git-report` 目录，例如：

```text
.codex/skills/weekly-git-report/
```

本包不会修改客户端的全局配置，也不提供自动卸载命令。

## 常见错误

### 文件已经存在

默认使用安全的“不覆盖”写入。如果目标 `SKILL.md` 已存在，命令会失败。确认可以覆盖后增加 `--force`。

### 安装到了错误项目

安装位置以当前工作目录为基准。切换到正确项目目录后重新执行命令。

### 安装后没有生效

确认文件位于目标客户端要求的目录，并重启对应客户端。

### `--target` 无效

只接受 `opencode`、`claude`、`codex` 或 `all`，不区分大小写。

## 发布内容

- `dist`：`weekly-skill` 命令构建产物
- `skills/weekly-git-report/SKILL.md`：Agent Skill 模板
- `README.md`
