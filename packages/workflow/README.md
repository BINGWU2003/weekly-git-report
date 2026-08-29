# @weekly-git-report/workflow

内部应用服务包，供 CLI、Electron 和兼容 MCP 复用。

```text
cli / electron / mcp -> workflow -> core -> shared
```

统一生成入口为 `prepareReportRun`、`generateBuiltInRun`、`completeExternalRun` 和 `approveReportRun`。运行元数据与步骤写入 Node 22 内置 SQLite，Raw、结构化生成输入、草稿和正文只保存在文件系统。SQLite 同时承担跨 CLI/Electron 进程的单运行队列约束，后来的采集与生成请求保持 `queued`，直到当前 Run 离开采集/生成阶段。

`listProjects` 和 `syncProjects` 会附加本地缓存中的配置分支最新提交运行状态，但不会因此访问远程仓库。

`collectGitLogs` 会先同步显式配置且已启用的项目，再采集指定远程分支；Raw 与日报、周报、月报、自定义报告类型无关。`saveSummary` 校验类型周期、写入 Sidecar，并按类型化文件名隔离不同报告；同一文件被替换时写入历史备份。路径安全逻辑限制 Raw 与 Summary 操作位于 `outputRoot` 内。

内置 AI 使用 AI SDK 7 的 OpenAI、DeepSeek 官方 Provider，不自动重试或切换模型。飞书发布只接受 Sidecar 和内容 Hash 均有效的 Summary，网络错误最多重试三次。系统调度适配 Windows Task Scheduler、macOS launchd 和 Linux user systemd timer，每次触发执行一次后退出。
