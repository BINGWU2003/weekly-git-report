# @weekly-git-report/mcp

weekly-git-report 的 MCP stdio server。它向支持 MCP 的客户端提供项目查询、同步、Git 提交采集、raw 读取和 summary 保存能力。

## 环境要求

- Node.js 20.19+
- Git
- 支持 stdio server 的 MCP 客户端
- 已通过 [`@weekly-git-report/cli`](https://github.com/BINGWU2003/weekly-git-report/tree/main/packages/cli) 初始化配置并添加项目

首次使用前，在交互式终端运行：

```sh
npx -y @weekly-git-report/cli@latest
```

## 快速开始

将以下内容加入 MCP 客户端配置：

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

重启或重新加载 MCP 客户端后，可以要求客户端：

```text
采集 2026-08-18 到 2026-08-24 的 Git 提交，生成周报总结并保存。
```

典型 tool 调用顺序是：

1. `list_projects`：确认项目配置。
2. `collect_git_logs`：自动同步并生成 raw。
3. `read_week_raw`：读取项目 Markdown。
4. 客户端根据 raw 生成总结。
5. `save_week_summary`：保存最终 Markdown。

`collect_git_logs` 已包含同步步骤，通常不需要提前调用 `sync_projects`。

## 安装方式

推荐在 MCP 配置中使用 `npx -y @weekly-git-report/mcp@latest`，无需全局安装。

也可以全局安装：

```sh
npm install -g @weekly-git-report/mcp
weekly-git-report-mcp
```

全局安装后，MCP 配置可以将 `command` 设为 `weekly-git-report-mcp`，并省略 `args`。

## Tools

所有日期字段必须使用 `YYYY-MM-DD`。tool 结果以格式化 JSON 文本返回。

### `list_projects`

列出 `~/.weekly-git-report/projects.json` 中的全部显式项目，包括已禁用项目。

```json
{}
```

结果中的项目包含 `id`、`name`、`path`、`remote`、`branch`、`enabled`、可选 `authors`，以及从本地缓存读取的 `runtime`/`latestCommit`。运行状态读取不访问远程服务。

### `sync_projects`

同步全部已启用项目：

```json
{
  "projectIds": []
}
```

同步指定项目：

```json
{
  "projectIds": ["api", "github.com/example/web"]
}
```

`projectIds` 可使用完整项目 ID 或完整名称。省略或传空数组时选择全部已启用项目；未知或已禁用项目会导致调用失败。单项目失败进入结果的 `errors`，其他项目继续处理。结果的 `runtime` 包含同步后各配置分支的缓存提交状态。

### `collect_git_logs`

自动同步并采集全部已启用项目：

```json
{
  "since": "2026-08-18",
  "until": "2026-08-24",
  "author": [],
  "projectIds": []
}
```

只采集指定项目和作者：

```json
{
  "since": "2026-08-18",
  "until": "2026-08-24",
  "author": ["Zhang San", "zhangsan@example.com"],
  "projectIds": ["api"]
}
```

- `author` 可以是单个字符串或字符串数组，按完整姓名或完整邮箱匹配，不区分大小写。
- `author` 为空时，使用项目 `authors`，再回退到全局 `identities`。
- `projectIds` 为空时，选择全部已启用项目。
- 返回值包含 `outputDir`、`indexFile`、`manifestFile`、项目数、提交数和 `errors`。

### `get_week_index`

读取已采集周期的 `index.md`：

```json
{
  "start": "2026-08-18",
  "end": "2026-08-24"
}
```

返回 `{"content": "..."}`。

### `read_week_raw`

读取该周期 manifest 声明的全部项目 Markdown：

```json
{
  "start": "2026-08-18",
  "end": "2026-08-24"
}
```

返回 `{"files": [{"name": "...", "content": "..."}]}`。未被 manifest 声明的 Markdown 不会被读取。

### `save_week_summary`

保存总结 Markdown：

```json
{
  "start": "2026-08-18",
  "end": "2026-08-24",
  "content": "# 本周总结\n\n- 完成功能 A\n"
}
```

返回 `summaryFile` 和写入的 `bytes`。内容不能为空；如果末尾没有换行，保存时会自动补充。

## 项目选择与错误处理

- `list_projects` 返回全部项目，其他同步和采集 tool 只选择 `enabled: true` 的项目。
- 项目选择器按完整 ID 或完整名称匹配。
- 单项目同步或采集失败不会中断其他项目，失败详情进入 `errors`。
- 配置缺失、输入校验失败、未知或已禁用项目等请求级错误会使对应 tool 调用失败。

## 文件安全

`get_week_index`、`read_week_raw` 和 `save_week_summary` 都根据日期计算目标路径。raw 读取和 summary 写入被限制在配置的 `outputRoot` 内，不能通过 tool 输入访问其他路径。

## 常见问题

### server 启动后找不到配置

先在运行 MCP server 的同一用户环境中执行 `npx -y @weekly-git-report/cli@latest init`。配置保存在用户目录，而不是 MCP 客户端项目目录。

### tool 列表没有出现

确认客户端支持 stdio MCP server，配置中的 `command` 与 `args` 可在终端运行，然后重启或重新加载客户端。

### raw 读取失败

先以完全相同的日期范围调用 `collect_git_logs`。读取参数的 `start/end` 必须与采集参数的 `since/until` 对应。

完整配置、同步语义和输出目录见[项目文档](https://github.com/BINGWU2003/weekly-git-report)。
