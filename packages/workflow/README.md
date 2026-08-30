# @weekly-git-report/workflow

Weekly Git Report 的内部用例编排层，供 CLI、MCP 和 Desktop Main 复用。

```text
CLI / MCP / Desktop Main → Workflow → Core → Shared
```

## 职责

- 编排 ReportRun 的排队、同步、采集、生成、审核、保存、发布、取消和重试。
- 使用 Node.js 内置 SQLite 持久化 Run 与步骤状态，并协调跨进程活动槽位。
- 生成和验证脱敏 `generationInput`、模板 revision 与 Raw manifest 哈希。
- 通过 AI SDK 连接 OpenAI 和 DeepSeek，流式写入草稿。
- 保存报告正文与关联信息文件，处理历史备份和强制覆盖确认。
- 校验报告内容后构建飞书卡片、签名并执行有限网络重试。
- 将报告任务同步到 Windows Task Scheduler、macOS `launchd` 和 Linux 用户级 `systemd timer`。
- 提供仓库列表、同步、采集、Raw 读取和 Summary 保存等低阶工作流。

## ReportRun API

统一生成入口包括：

- `prepareReportRun`
- `generateBuiltInRun`
- `completeExternalRun`
- `approveReportRun`

内置 AI 与 external-agent 在生成阶段不同，但共享准备、完整性校验、保存和推送链路。完整状态图见[工作原理](../../docs/how-it-works.md#reportrun-状态)。

## 一致性

- SQLite 状态转换拒绝非法跳转。
- 唯一活动索引限制同时处于采集或生成的 Run。
- 保存前校验 generation input 哈希、模板 revision 和 manifest 哈希。
- Sidecar 记录正文哈希；飞书发送前再次读取并验证。
- 正常替换自动备份；`force` 只处理用户确认的既有 Sidecar 异常。

## 外部集成

- **AI**：仅 OpenAI 与 DeepSeek，不自动重试或切换供应商；模型和参数由应用版本管理。
- **飞书**：只发送有效的已保存报告；临时网络/限流最多重试 3 次，即最多 4 次请求。
- **调度**：注册系统原生一次性触发命令，不运行常驻轮询服务。

## 开发

```sh
pnpm --filter @weekly-git-report/workflow check-types
pnpm --filter @weekly-git-report/workflow test
pnpm --filter @weekly-git-report/workflow build
```

该包是私有 workspace 包。分层与入口见[系统架构](../../docs/architecture.md#workflow应用用例)。
