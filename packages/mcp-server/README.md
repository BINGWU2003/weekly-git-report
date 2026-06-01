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
