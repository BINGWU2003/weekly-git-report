# @weekly-git-report/workflow

内部工作流包，供 MCP 和 Agent CLI 复用。

```text
mcp / agent-cli -> workflow -> core -> shared
```

主要导出：`listProjects`、`syncProjects`、`collectGitLogs`、`getWeekIndex`、`readWeekRaw`、`saveWeekSummary`。

`collectGitLogs` 会先同步显式配置且已启用的项目，再采集指定远程分支；路径安全逻辑限制 raw 和 summary 操作位于 `outputRoot` 内。
