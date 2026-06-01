# @weekly-git-report/mcp-server

用于读取已扫描 Git 项目和周报原始记录的 MCP stdio server。

## 启动方式

不需要全局安装。发布到 npm 后，推荐让 MCP Client 通过 `npx` 按需安装并启动。

## MCP Client 配置

```json
{
  "mcpServers": {
    "weekly-git-report": {
      "command": "npx",
      "args": ["-y", "@weekly-git-report/mcp-server@latest"]
    }
  }
}
```

如需固定版本，将 `@latest` 改成具体版本，例如 `@weekly-git-report/mcp-server@1.0.0`。

如果只想临时验证 MCP Server 能否启动，可以运行：

```sh
npx -y @weekly-git-report/mcp-server@latest
```

使用 MCP 工具前，请先通过 `@weekly-git-report/cli` 执行 `weekly init` 和 `weekly scan`。

## 工具

- `list_projects`：列出已扫描 Git 项目。
- `scan_projects`：扫描项目并更新项目索引。
- `collect_git_logs`：采集 Git 提交记录并写入原始记录文件。
- `get_week_index`：读取指定周期的 `index.md`。
- `read_week_raw`：读取指定周期所有项目 Markdown 原始记录。
- `save_week_summary`：保存指定周期的周报总结 Markdown 到 `summary` 目录。

`save_week_summary` 会写入：

```text
{outputRoot}/summary/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}.md
```

参数示例：

```json
{
  "start": "2026-06-01",
  "end": "2026-06-07",
  "content": "# 周报总结\n\n- 完成 Git 提交记录采集和整理。"
}
```
