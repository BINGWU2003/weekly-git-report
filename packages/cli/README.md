# @weekly-git-report/cli

Weekly Git Report 的统一命令行入口。它提供交互式配置、仓库和集成管理，也为 Agent、脚本与 CI 提供稳定 JSON 命令。

跨入口的工作原理、存储和安全边界见[项目文档](../../docs/README.md)。

## 环境要求

- Node.js 22.13+
- Git
- 初始化和部分配置命令需要交互式终端

## 使用方式

无需安装即可进入交互式菜单：

```sh
npx -y @weekly-git-report/cli@latest
```

也可以全局安装：

```sh
npm install -g @weekly-git-report/cli
weekly --help
```

以下示例使用 `weekly`；一次性运行时可替换为 `npx -y @weekly-git-report/cli@latest`。

## 首次设置

```sh
weekly init
weekly projects add
weekly doctor
```

`init` 会创建：

- 全局配置和空仓库索引。
- 报告正文与采集数据目录。
- 日报、周报、月报和自定义报告四套模板。

初始化只补齐缺失文件，不覆盖已有配置或模板。完整引导见[入门指南](../../docs/getting-started.md#cli)。

## 命令参考

| 命令                                                   | 交互 | 说明                                  |
| ------------------------------------------------------ | ---- | ------------------------------------- |
| `weekly`                                               | 是   | TTY 中显示操作菜单；非 TTY 中显示帮助 |
| `weekly init`                                          | 是   | 初始化配置、目录和四套模板            |
| `weekly config edit`                                   | 是   | 编辑报告目录、空仓库策略和作者身份    |
| `weekly projects add`                                  | 是   | 验证远程仓库并添加配置                |
| `weekly projects edit`                                 | 是   | 编辑并重新同步仓库                    |
| `weekly projects remove`                               | 是   | 删除配置，可选择永久删除缓存          |
| `weekly projects import [folder] [--all]`              | 可选 | 扫描本地文件夹并批量添加仓库          |
| `weekly projects list`                                 | 否   | 输出仓库和本地运行状态 JSON           |
| `weekly projects sync [selection]`                     | 可选 | 同步全部或指定的已启用仓库            |
| `weekly collect [options]`                             | 否   | 同步并采集指定日期范围                |
| `weekly raw index --start ... --end ...`               | 否   | 读取日期范围的采集索引                |
| `weekly raw read --start ... --end ...`                | 否   | 读取日期范围的仓库采集文件            |
| `weekly summary save --type ... [period]`              | 否   | 保存报告正文与关联信息文件            |
| `weekly templates init [--type ...\|--all]`            | 否   | 初始化缺失模板                        |
| `weekly templates read --type ... [period]`            | 否   | 读取模板与日期变量渲染结果            |
| `weekly templates write [options]`                     | 否   | 从文件或 stdin 更新模板               |
| `weekly templates reset --force`                       | 否   | 恢复内置默认模板                      |
| `weekly doctor`                                        | 否   | 检查 Git、配置、模板、仓库和报告      |
| `weekly ai configure\|status\|test\|clear`             | 可选 | 管理 OpenAI 或 DeepSeek               |
| `weekly feishu configure\|status\|test\|clear`         | 可选 | 管理飞书群机器人                      |
| `weekly tasks list\|add\|edit\|remove`                 | 否   | 管理报告任务                          |
| `weekly tasks enable\|disable\|run\|execute\|schedule` | 否   | 启停、立即执行或同步系统调度          |
| `weekly runs prepare\|complete\|fail`                  | 否   | external-agent Run 协议               |
| `weekly runs list\|show\|retry\|cancel\|publish`       | 否   | 查询和操作 ReportRun                  |

具体参数以 `weekly <command> --help` 为准。

## 自动化约定

非交互命令遵循以下约定：

- stdout 只写入 JSON 结果。
- 进度与诊断写入 stderr。
- 配置、参数或流程失败时退出码为 `1`。
- 仓库同步或采集允许部分执行，但存在项目级错误时仍返回退出码 `1`，JSON 中保留完整 `errors`。
- 自动化调用方必须同时检查退出码与 JSON，不能把 stderr 当作报告数据。

## External-agent Run

外部 Agent 使用两阶段协议：

```sh
weekly runs prepare --type weekly
weekly runs complete RUN_ID --file ./weekly-report.md
```

`runs prepare` 会重新同步和采集，固定模板 revision，并返回：

- `runId` 和当前 Run。
- 渲染后的 `template`。
- 脱敏的 `generationInput`。

日报、周报、月报省略日期时使用当前周期。自定义报告必须同时传入 `--start`、`--end`，可追加 `--title`；只有重新生成同一份自定义报告时才沿用 `--report-id`。

`runs complete` 未传 `--file` 时从 stdin 读取 Markdown。只有本次明确要求推送飞书时才添加 `--publish`。无法生成时结束 Run：

```sh
weekly runs fail RUN_ID --message "生成失败原因"
```

仅预览、不保存时应在展示结果后取消仍在生成的 Run：

```sh
weekly runs cancel RUN_ID
```

已保存报告需要补推或重试时使用：

```sh
weekly runs publish RUN_ID
```

完整状态与保存行为见[工作原理](../../docs/how-it-works.md#reportrun-状态)。

## 报告正文与低阶命令

`summary save` 支持 `daily`、`weekly`、`monthly` 和 `custom`。自定义报告可以指定标题与报告 ID。它会保存 Markdown 和同名 `.meta.json`，并校验报告类型、周期和采集 manifest。

```sh
Get-Content ./weekly-report.md | weekly summary save --type weekly --start 2026-08-17 --end 2026-08-23
```

通常优先使用 `runs prepare/complete`，因为 ReportRun 还能固定模板和生成输入来源。`collect`、`raw` 与 `summary` 主要用于低阶脚本和诊断。

正常替换同类型同周期报告会自动备份到 `.history/`。只有现有报告关联信息异常且用户明确确认后，才对新 Run 的首次完成操作使用 `--force`；它不能绕过 generation input 或 Raw 来源校验。

## 仓库管理

添加或编辑仓库时，CLI 会读取远程分支并确认：

- 仓库 URL、名称和采集分支。
- 独立缓存路径。
- 全局或仓库专属 Git 作者身份。
- 启用状态。

目标路径可以是空目录或 `origin` 与配置 URL 一致的 Git 仓库。仓库 URL 和本地路径都不能与其他项目重复。

批量导入：

```sh
weekly projects import /path/to/code
weekly projects import /path/to/code --all
```

扫描最多递归 4 层、识别 200 个仓库，不跟随符号链接。它只读取开发仓库的 `origin`，然后创建独立缓存，不修改源目录。

同步：

```sh
weekly projects sync --all
weekly projects sync --project project-a --project project-b
```

`projects list` 和同步结果中的最新提交来自本地缓存，不会为读取状态额外访问远程。

## 模板

四种模板位于 `~/.weekly-git-report/templates/{daily,weekly,monthly,custom}/summary.md`。

```sh
weekly templates init --all
weekly templates read --type monthly --start 2026-08-01 --end 2026-08-31
weekly templates write --type monthly --file ./summary-template.md --revision REVISION
weekly templates reset --type monthly --force
```

模板必须非空，并包含 `{{startDate}}` 和 `{{endDate}}`。读取返回原文、渲染结果、路径、revision 与默认状态；更新时应提交最新 revision。

## AI 与飞书

AI 支持 OpenAI 与 DeepSeek。配置时需要接受数据发送说明并完成连接测试；模型和生成参数由应用管理。

飞书支持一个全局群自定义机器人 Webhook 和可选签名密钥。非交互配置从 stdin 读取敏感值：AI 读取 API 密钥文本，飞书读取包含 `webhookUrl` 和可选 `signingSecret` 的 JSON，避免密钥出现在 shell 历史和进程参数中。

状态命令只返回非敏感配置状态和测试时间，不返回明文密钥。数据边界见[安全与隐私](../../docs/security.md)。

## 报告任务

任务支持 `daily`、`weekly` 和 `monthly`，不支持自定义报告。可配置：

- 任务名称、本地小时和分钟。
- 草稿审核或自动保存。
- 仓库筛选和补充背景。
- 是否保存后推送飞书。
- 日报是否包含周末。

启用任务时会注册系统原生调度。触发后执行一次 `weekly tasks execute <id>` 并退出，不启动后台轮询服务。周期规则见[工作原理](../../docs/how-it-works.md#周期语义)。

## 故障排查

先运行：

```sh
weekly doctor
```

常见问题和 Run 恢复方式见[故障排查](../../docs/troubleshooting.md)。

## 开发

```sh
pnpm --filter @weekly-git-report/cli check-types
pnpm --filter @weekly-git-report/cli test
pnpm --filter @weekly-git-report/cli build
```

内部包会被打入 CLI 发布产物。Monorepo 开发说明见[开发指南](../../docs/development.md)。
