# @weekly-git-report/workflow

内部工作流包，供 MCP 和统一 CLI 复用。

```text
mcp / cli -> workflow -> core -> shared
```

主要导出：`listProjects`、`syncProjects`、`collectGitLogs`、`getWeekIndex`、`readWeekRaw`、`saveWeekSummary`。

`listProjects` 和 `syncProjects` 会附加本地缓存中的配置分支最新提交运行状态，但不会因此访问远程仓库。

`collectGitLogs` 会先同步显式配置且已启用的项目，再采集指定远程分支；路径安全逻辑限制 raw 和 summary 操作位于 `outputRoot` 内。
