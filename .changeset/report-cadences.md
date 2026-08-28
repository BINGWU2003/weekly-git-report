---
"@weekly-git-report/cli": minor
"@weekly-git-report/mcp": patch
---

新增日报、周报和月报三种生成模板与 `--type` 流程。Summary 保存时写入周期 Sidecar、校验报告周期、备份重复保存内容，并为跨类型覆盖提供显式 `--force`；Doctor 同步检查三种模板和 Summary 元数据。

现有 MCP 周报工具面保持不变，保存周报时复用新的 Sidecar、周期校验和备份能力。
