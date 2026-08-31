# 数据与存储

Weekly Git Report 默认使用两个本地根目录：应用工作目录保存配置、缓存和运行状态；报告目录保存采集数据与最终报告。两者由同一套路径和 Schema 规则管理。

## 默认目录

```text
~/.weekly-git-report/
  config.json
  projects.json
  ai.json
  feishu.json
  tasks.json
  runs.db
  desktop-onboarding.json
  repositories/
  templates/
    daily/summary.md
    weekly/summary.md
    monthly/summary.md
    custom/summary.md
  runs/
    <runId>/
      generation-input.json
      draft.md

~/weekly-reports/
  raw/
    <year>/<month>/<start>_<end>/
      index.md
      manifest.json
      <project>-<urlHash>.md
  summary/
    <year>/<month>/
      <start>_<end>.<daily|weekly|monthly>.md
      <start>_<end>.<daily|weekly|monthly>.meta.json
      <start>_<end>.custom.<reportId>.md
      <start>_<end>.custom.<reportId>.meta.json
      .history/
    .trash/
```

以上是逻辑结构，文件会随配置和运行阶段逐步出现。`config.json` 可以修改报告目录和仓库缓存目录，因此实际位置可能不同。

## 应用配置

| 文件                      | 内容                                                  | 写入方式                                 |
| ------------------------- | ----------------------------------------------------- | ---------------------------------------- |
| `config.json`             | 报告目录、缓存目录、空仓库策略、全局 Git 作者身份     | Schema 校验、revision 冲突保护、原子写入 |
| `projects.json`           | 仓库 URL、分支、缓存路径、专属作者身份和启用状态      | Schema 校验、revision 冲突保护、原子写入 |
| `ai.json`                 | AI 服务、Base URL、模型、API 密钥、数据确认和测试状态 | 受限权限文件                             |
| `feishu.json`             | 机器人 Webhook、可选签名密钥和测试状态                | 受限权限文件                             |
| `tasks.json`              | 日报、周报、月报任务及调度配置                        | Schema 校验、revision 冲突保护、原子写入 |
| `desktop-onboarding.json` | Desktop 首次设置和首份报告恢复状态                    | Desktop 管理                             |

配置与仓库修改使用内容 revision。保存时必须提交读取到的 expected revision；文件已在其他窗口或进程中变化时，本次写入会失败并要求重新读取。

`ai.json` 当前使用 v2 结构，必须同时包含 AI 服务、Base URL、模型和 API Key。测试阶段不迁移旧版 v1 配置：应用会把它视为“AI 服务未配置”，继续正常启动，并要求在 Desktop 设置页或 CLI 中重新填写连接信息。旧文件不会被自动发送、测试或用于生成报告；保存新配置时会用 v2 内容覆盖它。

## 仓库缓存

默认 `repositories/` 保存只用于同步和读取 Git 日志的裸仓库，不检出工作树，也不会修改用户的日常开发目录。

每个项目的 `localPath` 在添加时确定。默认目录名包含仓库名称和远程 URL 的短哈希，避免不同组织中的同名仓库冲突。已有自定义 Git 路径只有在 `origin` 与配置 URL 匹配时才能使用。

删除项目默认只删除 `projects.json` 中的配置。只有经过绝对路径、仓库类型、`origin` 和危险目录检查，并由用户再次确认后，才会永久删除缓存目录。

## 报告模板

四种报告模板分别保存在：

- `templates/daily/summary.md`
- `templates/weekly/summary.md`
- `templates/monthly/summary.md`
- `templates/custom/summary.md`

模板必须包含 `{{startDate}}` 和 `{{endDate}}`。读取时会渲染日期变量并返回 revision；写入时使用 revision 防止覆盖其他进程的修改。初始化只补齐缺失模板，不覆盖已有内容。

## ReportRun 与 SQLite

`runs.db` 保存 ReportRun 和步骤状态。核心表包括：

- `report_runs`：报告类型、周期、生成器、状态、路径、错误和 Token 用量。
- `report_run_steps`：采集、生成、审核、保存和推送步骤的尝试与状态。

数据库中的状态转换限制非法跳转，并使用唯一活动索引协调并发采集和生成。SQLite 只保存运行元数据；完整生成输入和草稿保存在 `runs/<runId>/`。

### `generation-input.json`

保存本次固定的模板信息、脱敏提交事实和内容哈希。内置 AI、外部 Agent 完成和重试都会验证它没有被修改。

### `draft.md`

保存内置 AI 的流式输出或外部 Agent 提交的 Markdown。草稿可以处于待审核状态，不代表最终报告已经写入 `summary/`。

## 采集数据（Raw）

Raw 只按日期范围组织，与日报、周报、月报或自定义报告类型无关。同一周期可以被多种报告复用，但每次 ReportRun 仍会重新同步和采集。

### 项目文件

`<project>-<urlHash>.md` 记录一个仓库的匹配提交。文件名包含 URL 短哈希，避免同名项目冲突。

### `index.md`

提供本周期的项目索引和摘要，便于人工审计。

### `manifest.json`

记录周期、生成时间、项目文件、提交数量和采集错误。保存报告时会计算并校验 manifest 哈希，防止报告关联到已变化的采集来源。

## 报告正文与关联信息

标准报告正文按类型使用不同文件名：

```text
<start>_<end>.daily.md
<start>_<end>.weekly.md
<start>_<end>.monthly.md
```

自定义报告包含稳定的 `reportId`，允许同一日期范围保存多份不同报告：

```text
<start>_<end>.custom.<reportId>.md
```

每份正文都有同名 `.meta.json` 关联信息文件。它记录：

- 报告 ID、报告类型和周期。
- Run、可选任务 ID和生成器。
- AI 供应商、模型和 Token 用量（适用时）。
- 模板 revision、Raw manifest 哈希和补充背景哈希。
- 保存时间与 Markdown 内容哈希。

报告库在 Sidecar 缺失或无效时仍可显示 Markdown，但会标记“报告信息异常”。此类报告不能推送飞书，覆盖前需要用户明确确认。

## 历史备份与回收站

正常替换同一路径的报告时，旧正文和 Sidecar 会先备份到相邻 `.history/`。这与强制覆盖不同：正常替换不需要额外确认，关联信息异常才需要显式 `force`。

Desktop 删除报告时会把正文、Sidecar 和原始位置信息移动到 `summary/.trash/`，支持恢复。永久删除会清理回收站中的对应文件。

## 原子性与路径边界

- JSON 和文本配置通过临时文件与替换操作原子写入。
- Raw、Summary、历史备份和回收站路径都必须解析在报告目录内。
- 报告索引只识别规范目录和文件名，不把任意 Markdown 当作受管理报告。
- 报告目录与仓库缓存目录不能相同、互相嵌套或直接使用应用配置目录。

安全原因和威胁边界见[安全与隐私](security.md)。
