# CLI 错误恢复

仅在 `runs prepare`、`runs complete`、`runs publish` 或预览后的 `runs cancel` 失败时读取本文件。不要无条件重试会写文件或发送飞书的命令。

## 通用判断

- stdout 仅按 JSON 解析；stderr 与非零退出码按失败处理。
- 已知 `RUN_ID` 时，用只读命令确认持久化状态：

```sh
npx -y @weekly-git-report/cli@latest runs show RUN_ID
```

- 缺少初始化或仓库配置：停止并引导用户使用 weekly-git-report Desktop，或在交互式终端运行 `npx -y @weekly-git-report/cli@latest`。不要在本 Skill 中初始化或修改配置。

## Prepare 失败

同步或采集任一仓库失败时，不存在可供生成的可信完整输入。停止本次流程，不生成、保存或发布报告；不要读取部分 Raw 拼装结果。

## Complete 失败

1. 调用 `runs show RUN_ID`。
2. 按持久化状态处理：
   - `succeeded` 且存在 `summaryPath`：报告保存成功，不要再次完成。
   - `publish_failed` 且存在 `summaryPath`：报告已经保存，仅飞书发布失败。分别报告保存成功和发布失败，不要再次完成。
   - `generating`：CLI 尚未进入保存状态。修复临时文件读取或 draft 写入问题后，可以对同一个 Run 重试 `runs complete`；若决定放弃，调用 `runs cancel RUN_ID` 后停止。
   - `awaiting_review` 或 `saving`：不能对同一个 external-agent Run 重试 `runs complete`。修复原因后重新 `runs prepare`，使用新 Run 重新生成和保存。
   - `failed` 或 `cancelled`：不要重试完成；需要继续时重新准备 Run。
3. 重新准备自定义报告时沿用原 `reportId`，并保持原类型、周期、标题、项目筛选和补充事实。

## Publish 失败

1. 调用 `runs show RUN_ID`。
2. 若状态为 `publish_failed` 且存在 `summaryPath`，报告“本地报告已保存，飞书推送失败”。
3. 配置或连接恢复后，只有用户明确要求再次发送时才调用 `runs publish RUN_ID`。

## `--force`

`--force` 只处理现有 Summary 的元数据异常，不处理 Raw 或来源完整性错误。

保存失败后不能向原 Run 追加 `--force` 重试。必须重新准备 Run，并在用户明确同意覆盖后，首次调用新 Run 的 `runs complete` 时追加 `--force`。不要因为普通的同周期替换使用它；正常替换已有自动备份。

## Cancel 失败

预览后的 `runs cancel` 失败时，调用 `runs show RUN_ID`。若 Run 仍为 `generating`，明确报告清理失败；在它被取消或终止前不要发起新的 `runs prepare`，否则新 Run 可能持续等待活跃槽位。
