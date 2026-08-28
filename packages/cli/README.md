# @weekly-git-report/cli

weekly-git-report 的统一命令行入口。它既提供交互式配置和项目管理，也为 Agent、脚本和 CI 提供稳定 JSON 命令，用于同步、采集、读取 raw 和保存 summary。

## 环境要求

- Node.js 20.19+
- Git
- 初始化、添加、编辑和删除项目时需要交互式终端

## 快速开始

无需安装即可进入交互式菜单：

```sh
npx -y @weekly-git-report/cli@latest
```

首次使用时：

1. 选择 `Initialize configuration`。
2. 设置周报输出目录、仓库缓存目录、是否包含空项目，以及至少一个 Git 作者身份。
3. 选择添加仓库，并确认 URL、分支、名称、本地路径、作者身份和启用状态。
4. 运行环境检查。

```sh
npx -y @weekly-git-report/cli@latest doctor
```

`doctor` 返回 JSON 检查结果；所有 `checks[].ok` 都是 `true` 时环境可用。

## 安装方式

一次性使用推荐 `npx`：

```sh
npx -y @weekly-git-report/cli@latest projects list
```

也可以全局安装，此后使用 `weekly`：

```sh
npm install -g @weekly-git-report/cli
weekly
```

## 命令

| 命令                                        | 是否交互 | 说明                                     |
| ------------------------------------------- | -------- | ---------------------------------------- |
| `weekly`                                    | 是       | 在 TTY 中显示操作菜单；非 TTY 中显示帮助 |
| `weekly init`                               | 是       | 初始化配置、输出目录和项目索引           |
| `weekly config edit`                        | 是       | 编辑全局目录、空项目策略和作者身份       |
| `weekly projects add`                       | 是       | 验证远程仓库并添加项目                   |
| `weekly projects edit`                      | 是       | 编辑并重新同步项目                       |
| `weekly projects remove`                    | 是       | 移除项目，可选择同时删除 Bare Git 缓存   |
| `weekly projects list`                      | 否       | 以稳定 JSON DTO 输出全部显式项目         |
| `weekly projects sync [selection]`          | 可选     | 同步全部或指定的已启用项目               |
| `weekly collect [options]`                  | 否       | 同步并采集指定周期的 Git 提交            |
| `weekly raw index --start ... --end ...`    | 否       | 读取周期 raw 索引                        |
| `weekly raw read --start ... --end ...`     | 否       | 读取周期内的项目 Markdown                |
| `weekly summary save --start ... --end ...` | 否       | 从文件或 stdin 保存最终总结              |
| `weekly doctor`                             | 否       | 检查 Git、配置、项目路径和 `origin`      |
| `weekly --help`                             | 否       | 显示命令帮助                             |

使用 `npx` 时，将表中的 `weekly` 替换为 `npx -y @weekly-git-report/cli@latest`。

## 完整配置流程

### 初始化

```sh
npx -y @weekly-git-report/cli@latest init
```

配置写入：

```text
~/.weekly-git-report/config.json
~/.weekly-git-report/projects.json
```

`init` 会创建输出目录和项目索引。如果全局配置已经存在，它会保留现有配置，并补齐缺失的项目索引。

### 添加或编辑项目

```sh
npx -y @weekly-git-report/cli@latest projects add
npx -y @weekly-git-report/cli@latest projects edit
```

CLI 会先读取远程分支，再让你确认：

- 仓库 URL 和分支
- 仓库名称
- 本地缓存路径
- 是否继承全局 Git 身份
- 是否启用项目

目标路径不存在时会创建裸仓库缓存。已有 Git 仓库必须拥有与配置 URL 匹配的 `origin`；非空的普通目录不会被覆盖。项目 URL 和本地路径都不能与其他项目重复。

### 查看项目

```sh
npx -y @weekly-git-report/cli@latest projects list
```

输出是供自动化使用的稳定 JSON DTO，包括已禁用项目，但不暴露配置文件的存储字段命名。例如：

```json
{
  "projects": [
    {
      "id": "github.com/example/project-a",
      "name": "project-a",
      "path": "/home/name/.weekly-git-report/repositories/project-a-a1b2c3d4",
      "remote": "git@github.com:example/project-a.git",
      "branch": "main",
      "enabled": true
    }
  ]
}
```

### 同步项目

同步一个项目：

```sh
npx -y @weekly-git-report/cli@latest projects sync project-a
```

非交互调用也可以重复传入项目，或显式同步全部：

```sh
npx -y @weekly-git-report/cli@latest projects sync --project project-a --project project-b
npx -y @weekly-git-report/cli@latest projects sync --all
```

不传项目时：

- 在 TTY 中且存在多个已启用项目，会提示选择单个项目或全部项目。
- 在非 TTY 中，或只有一个已启用项目时，会同步全部已启用项目。

同步结果写入 stdout JSON：

```json
{
  "projectCount": 1,
  "projects": [
    {
      "id": "github.com/example/project-a",
      "name": "project-a",
      "branch": "main",
      "path": "/home/name/.weekly-git-report/repositories/project-a-a1b2c3d4"
    }
  ],
  "errors": []
}
```

任一仓库同步失败时，其他仓库继续处理，但命令退出码为 `1`。

## Agent 和脚本自动化

以下命令构成完整的总结流程：

```sh
npx -y @weekly-git-report/cli@latest collect --since 2026-08-18 --until 2026-08-24 --all
npx -y @weekly-git-report/cli@latest raw read --start 2026-08-18 --end 2026-08-24
npx -y @weekly-git-report/cli@latest summary save --start 2026-08-18 --end 2026-08-24 --file ./weekly-summary.md
```

`collect` 支持重复的 `--author <name-or-email>` 和 `--project <id-or-name>`。`summary save` 未传 `--file` 时从 stdin 读取 Markdown：

```sh
Get-Content ./weekly-summary.md | npx -y @weekly-git-report/cli@latest summary save --start 2026-08-18 --end 2026-08-24
```

自动化命令只向 stdout 写入 JSON。配置错误、参数错误等诊断写入 stderr 并返回退出码 `1`；同步或采集出现项目级错误时，也会保留完整 JSON 并返回退出码 `1`。

### 删除项目

```sh
npx -y @weekly-git-report/cli@latest projects remove
```

CLI 会先询问是否同时永久删除 Bare Git 缓存，默认选择“否”，此时只移除
`projects.json` 中的配置并保留本地文件。选择删除缓存后，会显示缓存的绝对路径并再次确认。

为避免误删，缓存目录必须同时满足以下条件才会被删除：

- 是真实目录而不是符号链接；
- 不是磁盘根目录、用户目录、当前工作目录或仓库缓存根目录；
- 是 Bare Git 仓库；
- `origin` 与项目配置的 URL 一致。

## 常见问题

### 命令提示需要交互式终端

`init`、`config edit`、`projects add`、`projects edit` 和 `projects remove` 需要 stdin 与 stdout 都连接到 TTY。自动化场景请使用同一 CLI 的 `projects list/sync`、`collect`、`raw` 和 `summary` 命令。

### 找不到匹配的已启用项目

运行 `projects list`，确认名称或 ID 完全匹配，并检查项目的 `enabled` 是否为 `true`。

### 本地仓库或 origin 检查失败

运行 `doctor` 查看具体项目。自定义路径必须是空目录，或是 `origin` 与项目配置一致的 Git 仓库。

## 后续使用

配置完成后，可以选择：

- [安装 Agent Skill](https://github.com/BINGWU2003/weekly-git-report/tree/main/skills/weekly-git-report)
- [配置 MCP server](https://github.com/BINGWU2003/weekly-git-report/tree/main/packages/mcp)
- 直接通过本包的 JSON 命令进行 Agent、脚本或 CI 自动化

完整配置结构、同步语义和输出目录见[项目文档](https://github.com/BINGWU2003/weekly-git-report)。
