# @weekly-git-report/cli

weekly-git-report 的统一命令行入口。它既提供交互式配置、项目与生成模板管理，也为 Agent、脚本和 CI 提供稳定 JSON 命令，用于同步、采集、读取模板和 raw，以及保存 summary。

## 环境要求

- Node.js 22.12+
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

| 命令                                                                      | 是否交互 | 说明                                     |
| ------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| `weekly`                                                                  | 是       | 在 TTY 中显示操作菜单；非 TTY 中显示帮助 |
| `weekly init`                                                             | 是       | 初始化配置、输出目录和项目索引           |
| `weekly config edit`                                                      | 是       | 编辑全局目录、空项目策略和作者身份       |
| `weekly projects add`                                                     | 是       | 验证远程仓库并添加项目                   |
| `weekly projects edit`                                                    | 是       | 编辑并重新同步项目                       |
| `weekly projects remove`                                                  | 是       | 移除项目，可选择同时删除 Bare Git 缓存   |
| `weekly projects import [folder] [--all]`                                 | 可选     | 从本地文件夹识别并批量添加仓库           |
| `weekly projects list`                                                    | 否       | 以稳定 JSON DTO 输出全部显式项目         |
| `weekly projects sync [selection]`                                        | 可选     | 同步全部或指定的已启用项目               |
| `weekly collect [options]`                                                | 否       | 同步并采集指定周期的 Git 提交            |
| `weekly raw index --start ... --end ...`                                  | 否       | 读取周期 raw 索引                        |
| `weekly raw read --start ... --end ...`                                   | 否       | 读取周期内的项目 Markdown                |
| `weekly summary save --type ... [period]`                                 | 否       | 保存日报、周报或月报及其 Sidecar         |
| `weekly templates init [--type ...\|--all]`                               | 否       | 初始化缺失的默认生成模板                 |
| `weekly templates read --type ... [period]`                               | 否       | 读取指定类型模板及日期变量渲染结果       |
| `weekly templates write [options]`                                        | 否       | 从文件或 stdin 安全更新模板              |
| `weekly templates reset --force`                                          | 否       | 恢复当前版本的内置默认模板               |
| `weekly doctor`                                                           | 否       | 检查环境、模板、Sidecar 和仓库           |
| `weekly ai configure\|status\|test\|clear`                                | 可选     | 配置并测试 OpenAI 或 DeepSeek            |
| `weekly feishu configure\|status\|test\|clear`                            | 可选     | 配置并测试飞书群机器人                   |
| `weekly tasks list\|add\|edit\|remove\|enable\|disable\|run\|schedule`    | 否       | 管理系统调度任务                         |
| `weekly runs prepare\|complete\|fail\|list\|show\|retry\|cancel\|publish` | 否       | 统一报告 Run 协议                        |
| `weekly --help`                                                           | 否       | 显示命令帮助                             |

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
~/.weekly-git-report/templates/daily/summary.md
~/.weekly-git-report/templates/weekly/summary.md
~/.weekly-git-report/templates/monthly/summary.md
```

`init` 会创建输出目录、项目索引和默认日报、周报、月报生成模板。如果全局配置已经存在，它会保留现有配置与模板内容，只补齐缺失文件。

### 管理报告生成模板

读取原始模板，或按指定周期渲染 `{{startDate}}`、`{{endDate}}`：

```sh
npx -y @weekly-git-report/cli@latest templates read
npx -y @weekly-git-report/cli@latest templates read --type daily --start 2026-08-28 --end 2026-08-28
npx -y @weekly-git-report/cli@latest templates read --type monthly --start 2026-08-01 --end 2026-08-28
```

未传 `--type` 时默认 `weekly`。四种模板分别保存在 `templates/daily`、`templates/weekly`、`templates/monthly`、`templates/custom` 下。CLI stdout 返回正文、渲染结果、路径、revision 和默认状态。读取时若文件缺失会自动创建，但绝不会覆盖已有内容。`templates init --all` 可一次补齐全部模板。

更新模板前先读取 revision，然后从文件或 stdin 写入：

```sh
npx -y @weekly-git-report/cli@latest templates write --type monthly --file ./summary-template.md --revision REVISION
Get-Content ./summary-template.md | npx -y @weekly-git-report/cli@latest templates write --type monthly --revision REVISION
```

模板必须非空，同时包含 `{{startDate}}`、`{{endDate}}`，不接受其他变量。确实需要跳过 revision 冲突保护时可使用 `--force`。恢复内置默认模板必须显式确认：

```sh
npx -y @weekly-git-report/cli@latest templates reset --type monthly --force
```

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

### 从文件夹批量导入

交互式扫描父目录并选择仓库：

```sh
npx -y @weekly-git-report/cli@latest projects import /path/to/code
```

非交互导入全部有效候选：

```sh
npx -y @weekly-git-report/cli@latest projects import /path/to/code --all
```

扫描最多递归 4 层和识别 200 个仓库，不跟随符号链接。CLI 只读取源仓库的 `origin`，自动生成名称、远程默认分支、独立 Bare 缓存路径、启用状态和全局身份继承配置。已存在、批次内重复、没有 `origin` 或远程检查失败的候选会跳过。

同步允许部分成功，只有成功项目会一次性写入 `projects.json`。非交互模式的扫描进度进入 stderr，stdout 只返回最终 JSON；同步错误非空时退出码为 `1`。

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
      "enabled": true,
      "runtime": {
        "projectId": "github.com/example/project-a",
        "status": "ready",
        "latestCommit": {
          "hash": "0123456789abcdef0123456789abcdef01234567",
          "subject": "feat: add repository import",
          "authorName": "Alice",
          "authorEmail": "alice@example.com",
          "committedAt": "2026-08-28T14:32:00+08:00"
        }
      }
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
  "runtime": [],
  "errors": []
}
```

任一仓库同步失败时，其他仓库继续处理，但命令退出码为 `1`。

`runtime` 从本地缓存读取，不触发网络请求。未同步、缓存分支缺失或缓存损坏时，`latestCommit` 为 `null`，并通过 `status` 和可选 `message` 说明原因。

## Agent 和脚本自动化

外部 Agent 使用统一的两阶段 Run 协议：

```sh
npx -y @weekly-git-report/cli@latest runs prepare --type weekly --start 2026-08-17 --end 2026-08-23
npx -y @weekly-git-report/cli@latest runs complete RUN_ID --file ./weekly-summary.md
```

`runs prepare` 每次重新同步和采集，并返回固定模板及不含专门的作者邮箱、本地路径、远程 URL 和 Diff 字段的 `generationInput`；提交文本或补充事实中原本存在的内容仍会保留。日报、周报、月报未传日期时默认生成当前周期；自定义报告必须传 `--start/--end`，可附加 `--title`。`runs complete` 未传 `--file` 时从 stdin 读取 Markdown；只有明确使用 `--publish` 才推送飞书。同类型同周期已有报告但元数据无法校验时，确认覆盖后可追加 `--force`，原文件会先备份到 `.history`。

```sh
Get-Content ./weekly-summary.md | npx -y @weekly-git-report/cli@latest summary save --type weekly --start 2026-08-17 --end 2026-08-23
```

Raw 与报告类型无关，只按日期范围保存。标准 Summary 写入 `summary/{year}/{month}/{start}_{end}.{daily|weekly|monthly}.md`，自定义报告写入 `{start}_{end}.custom.{reportId}.md`；同名 `.meta.json` 记录报告 ID、类型、Run、生成器、模型、模板 revision、Raw manifest Hash、周期和内容 Hash。缺少有效 Sidecar 的 Markdown 不可推送；同类型重复保存会备份到 `.history`。

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

`init`、`config edit`、`projects add`、`projects edit` 和 `projects remove` 需要 stdin 与 stdout 都连接到 TTY。`projects import` 在非 TTY 中必须同时提供目录和 `--all`。其他自动化场景可使用同一 CLI 的 `projects list/sync`、`templates`、`collect`、`raw` 和 `summary` 命令。

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
