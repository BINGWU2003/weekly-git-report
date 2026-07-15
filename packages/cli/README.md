# @weekly-git-report/cli

weekly-git-report 的初始化 CLI。它只负责创建本地配置和输出目录，不负责扫描项目、采集 Git 记录或安装 Agent Skill。

- 项目扫描、采集和周报读写：使用 `@weekly-git-report/agent-cli`
- Agent Skill 安装：使用 `@weekly-git-report/skill`
- MCP 常驻模式：使用 `@weekly-git-report/mcp`

## 环境要求

- Node.js 18 或更高版本
- Windows、macOS 或 Linux

## 安装

全局安装后使用 `weekly` 命令：

```sh
npm install -g @weekly-git-report/cli
weekly --help
```

也可以通过 `npx` 临时执行：

```sh
npx -y @weekly-git-report/cli@latest init
```

## 快速开始

```sh
weekly init
npx -y @weekly-git-report/agent-cli@latest projects scan
```

第一条命令创建配置和输出目录；第二条命令根据配置扫描 Git 项目。

## 命令

### `weekly init`

```sh
weekly init
```

该命令没有额外参数。

首次运行且终端支持交互时，会询问：

| 输入项       | 说明                                               | 默认值                           |
| ------------ | -------------------------------------------------- | -------------------------------- |
| `roots`      | Git 项目扫描根目录，多个目录可用中文或英文逗号分隔 | `~/work`、`~/Code`、`~/Projects` |
| `outputRoot` | raw 和 summary 的输出根目录                        | `~/weekly-reports`               |

非 TTY 环境不会显示交互问题，会直接使用默认配置。

如果 `~/.weekly-git-report/config.json` 已存在，命令会读取现有配置并补齐输出目录，不会覆盖配置文件。

成功输出示例：

```text
Created config: C:\Users\name\.weekly-git-report\config.json
Roots: ~/work, ~/Code, ~/Projects
Work dir: C:\Users\name\.weekly-git-report
Output root: C:\Users\name\weekly-reports
Raw dir: C:\Users\name\weekly-reports\raw
Summary dir: C:\Users\name\weekly-reports\summary
```

配置已经存在时，第一行显示 `Config already exists`。

## 配置文件

配置保存在：

```text
~/.weekly-git-report/config.json
```

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

| 字段                   | 类型       | 默认值                           | 说明                                                 |
| ---------------------- | ---------- | -------------------------------- | ---------------------------------------------------- |
| `roots`                | `string[]` | `~/work`、`~/Code`、`~/Projects` | 项目扫描根目录，至少需要一个                         |
| `excludeDirs`          | `string[]` | 常见依赖和构建目录               | 扫描时按目录名跳过                                   |
| `maxDepth`             | 正整数     | `5`                              | 项目扫描最大递归深度                                 |
| `outputRoot`           | `string`   | `~/weekly-reports`               | raw 和 summary 输出根目录                            |
| `author`               | `string[]` | `[]`                             | 默认 Git 作者；空数组时回退到 `git config user.name` |
| `defaultSince`         | `string`   | `last monday`                    | 默认采集开始时间，当前主要供底层配置兼容使用         |
| `defaultUntil`         | `string`   | `now`                            | 默认采集结束时间，当前主要供底层配置兼容使用         |
| `includeEmptyProjects` | `boolean`  | `false`                          | 是否为没有匹配提交的项目生成 raw 文件                |

路径支持 `~`、相对路径和绝对路径。Windows JSON 路径建议使用 `/`：

```json
{
  "roots": ["E:/workspace"],
  "outputRoot": "D:/weekly-reports"
}
```

如果使用反斜杠，需要写成 `D:\\weekly-reports`。

## 创建的目录

```text
~/.weekly-git-report/
  config.json

{outputRoot}/
  raw/
  summary/
```

`projects.json` 不由初始化命令创建。执行项目扫描后才会生成：

```sh
npx -y @weekly-git-report/agent-cli@latest projects scan
```

## 常见问题

### 修改配置后再次运行会覆盖吗？

不会。`weekly init` 只在配置文件不存在时创建文件。

### 如何重新生成默认配置？

先自行备份并删除 `~/.weekly-git-report/config.json`，再执行 `weekly init`。命令本身不提供覆盖或删除选项。

### 配置校验失败

检查 JSON 语法，并确认 `roots` 至少包含一个字符串、`maxDepth` 是正整数。

## 从 CLI 1.x 迁移

CLI 2.0 只保留初始化命令：

| CLI 1.x 命令           | 替代方式                                                     |
| ---------------------- | ------------------------------------------------------------ |
| `weekly scan`          | `weekly-agent projects scan`                                 |
| `weekly list`          | `weekly-agent projects list`                                 |
| `weekly collect`       | `weekly-agent collect`                                       |
| `weekly skill install` | `weekly-skill install` 或直接运行 `@weekly-git-report/skill` |

临时调用示例：

```sh
npx -y @weekly-git-report/agent-cli@latest projects scan
npx -y @weekly-git-report/skill@latest
```

## 发布内容

- `dist`：`weekly` 命令构建产物
- `README.md`
