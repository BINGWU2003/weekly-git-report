# @weekly-git-report/mcp-server

用于读取已扫描 Git 项目和周报原始记录的 MCP stdio server。

## 安装

```sh
npm install -g @weekly-git-report/mcp-server
```

## MCP Client 配置

```json
{
  "mcpServers": {
    "weekly-git-report": {
      "command": "weekly-git-report-mcp",
      "args": []
    }
  }
}
```

使用 MCP 工具前，请先通过 `@weekly-git-report/cli` 执行 `weekly init` 和 `weekly scan`。
