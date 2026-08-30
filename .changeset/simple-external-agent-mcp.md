---
"@weekly-git-report/mcp": major
---

将 MCP 收敛为 external-agent ReportRun 协议，使用 `prepare_report`、`complete_report`、`fail_report` 和 `publish_report` 统一支持日报、周报、月报与自定义报告。

移除旧的 weekly-only 项目查询、同步、Raw 读取和 Summary 直写工具。MCP 不再暴露任务、配置或内置 AI 能力；飞书仅在用户明确要求后推送。
