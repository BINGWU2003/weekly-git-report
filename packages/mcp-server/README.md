# @weekly-git-report/mcp-server

MCP stdio server for reading scanned Git projects and generated weekly raw commit reports.

## Install

```sh
npm install -g @weekly-git-report/mcp-server
```

## MCP Client Config

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

Run `weekly init` and `weekly scan` from `@weekly-git-report/cli` before using the MCP tools.
