# @weekly-git-report/mcp

weekly-git-report 的 MCP stdio server。首次使用前通过 `weekly` 交互式配置仓库。

## 配置

```json
{
  "mcpServers": {
    "weekly-git-report": {
      "command": "npx",
      "args": ["-y", "@weekly-git-report/mcp@latest"]
    }
  }
}
```

## Tools

| Tool                | 说明                                  |
| ------------------- | ------------------------------------- |
| `list_projects`     | 读取显式项目配置                      |
| `sync_projects`     | 同步全部或指定项目，输入 `projectIds` |
| `collect_git_logs`  | 自动同步并采集周期提交                |
| `get_week_index`    | 读取 raw 索引                         |
| `read_week_raw`     | 读取 manifest 声明的项目 Markdown     |
| `save_week_summary` | 保存总结 Markdown                     |

`collect_git_logs` 输入包含 `since`、`until`、可选 `author` 和 `projectIds`。作者参数为空时使用项目作者，再回退到全局 identities。

raw 读取和 summary 写入都限制在配置的 `outputRoot` 内。
