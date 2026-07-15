# @weekly-git-report/mcp

weekly-git-report 的 MCP stdio server，为支持 MCP 的 Agent 或客户端提供项目扫描、Git 记录采集、raw 读取和 summary 保存工具。

如果不希望 MCP tools 常驻上下文，可以改用 `@weekly-git-report/skill` 和 `@weekly-git-report/agent-cli`。

## 环境要求

- Node.js 18 或更高版本
- 本机已安装 Git
- MCP Client 支持 stdio server
- 首次使用前已通过 `weekly init` 创建配置

## 快速开始

初始化配置：

```sh
npx -y @weekly-git-report/cli@latest init
```

在 MCP Client 中加入：

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

重启或重新加载 MCP Client，然后按顺序调用：

1. `scan_projects`
2. `collect_git_logs`
3. `read_week_raw`
4. `save_week_summary`

## 启动方式

临时启动：

```sh
npx -y @weekly-git-report/mcp@latest
```

开发环境启动构建产物：

```sh
node packages/mcp/dist/index.js
```

这是 stdio server，不是 HTTP 服务。MCP Client 负责创建进程并通过 stdin/stdout 通信；诊断信息写入 stderr。

## MCP Client 配置

推荐使用 `@latest`：

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

固定版本：

```json
{
  "mcpServers": {
    "weekly-git-report": {
      "command": "npx",
      "args": ["-y", "@weekly-git-report/mcp@1.0.3"]
    }
  }
}
```

本地开发配置：

```json
{
  "mcpServers": {
    "weekly-git-report": {
      "command": "node",
      "args": ["D:/workspace/weekly-git-report/packages/mcp/dist/index.js"]
    }
  }
}
```

## 工具总览

| Tool                | 用途                            | 前置条件     |
| ------------------- | ------------------------------- | ------------ |
| `scan_projects`     | 扫描 Git 项目并更新索引         | 已初始化配置 |
| `list_projects`     | 列出索引中的项目                | 已完成扫描   |
| `collect_git_logs`  | 采集指定周期的 Git commit       | 已完成扫描   |
| `get_week_index`    | 读取周期的 `index.md`           | 已完成采集   |
| `read_week_raw`     | 读取周期内所有项目 raw Markdown | 已完成采集   |
| `save_week_summary` | 保存生成的 Markdown 周报        | 已初始化配置 |

所有工具结果都包装为 MCP text content，文本内容是格式化后的 JSON。

## 工具参考

### `scan_projects`

扫描参数指定的根目录；未指定时使用 `config.json` 中的 `roots` 和 `maxDepth`。

输入：

```json
{
  "roots": ["E:/workspace", "D:/projects"],
  "maxDepth": 6
}
```

| 字段       | 类型       | 必填 | 默认值              | 说明           |
| ---------- | ---------- | ---- | ------------------- | -------------- |
| `roots`    | `string[]` | 否   | 配置中的 `roots`    | 本次扫描根目录 |
| `maxDepth` | 正整数     | 否   | 配置中的 `maxDepth` | 最大递归深度   |

返回：

```json
{
  "projectCount": 3,
  "projectsFile": "C:/Users/name/.weekly-git-report/projects.json",
  "warnings": []
}
```

### `list_projects`

输入为空对象：

```json
{}
```

返回：

```json
{
  "projects": [
    {
      "id": "github.com/acme/order-service",
      "name": "order-service",
      "path": "E:/workspace/order-service",
      "remote": "git@github.com:acme/order-service.git",
      "branch": "main"
    }
  ]
}
```

### `collect_git_logs`

输入：

```json
{
  "since": "2026-06-01",
  "until": "2026-06-07",
  "author": ["张三", "李四"],
  "projectIds": ["order-service"]
}
```

| 字段         | 类型                 | 必填 | 默认值                           | 说明                                |
| ------------ | -------------------- | ---- | -------------------------------- | ----------------------------------- |
| `since`      | `YYYY-MM-DD`         | 是   | -                                | 采集开始日期                        |
| `until`      | `YYYY-MM-DD`         | 是   | -                                | 采集结束日期                        |
| `author`     | `string[]` 或 string | 否   | 配置 author，再回退到 Git 用户名 | Git 作者列表                        |
| `projectIds` | `string[]`           | 否   | `[]`                             | 项目 id 或 name；空数组表示全部项目 |

返回：

```json
{
  "outputDir": "D:/weekly-reports/raw/2026/06/2026-06-01_2026-06-07",
  "indexFile": "D:/weekly-reports/raw/2026/06/2026-06-01_2026-06-07/index.md",
  "manifestFile": "D:/weekly-reports/raw/2026/06/2026-06-01_2026-06-07/manifest.json",
  "projectCount": 3,
  "commitCount": 16,
  "errors": []
}
```

### `get_week_index`

输入：

```json
{
  "start": "2026-06-01",
  "end": "2026-06-07"
}
```

返回：

```json
{
  "content": "# Git 周报原始记录\n..."
}
```

### `read_week_raw`

输入：

```json
{
  "start": "2026-06-01",
  "end": "2026-06-07"
}
```

返回：

```json
{
  "files": [
    {
      "name": "order-service.md",
      "content": "# order-service\n..."
    }
  ]
}
```

该工具只读取 `manifest.json` 中声明的项目 Markdown，不返回 `index.md` 或目录中的其他文件。

### `save_week_summary`

输入：

```json
{
  "start": "2026-06-01",
  "end": "2026-06-07",
  "content": "# 周报总结\n\n- 完成项目发布。"
}
```

| 字段      | 类型         | 必填 | 说明              |
| --------- | ------------ | ---- | ----------------- |
| `start`   | `YYYY-MM-DD` | 是   | 周期开始日期      |
| `end`     | `YYYY-MM-DD` | 是   | 周期结束日期      |
| `content` | 非空 string  | 是   | Markdown 总结内容 |

返回：

```json
{
  "summaryFile": "D:/weekly-reports/summary/2026/06/2026-06-01_2026-06-07.md",
  "bytes": 1280
}
```

内容末尾缺少换行时会自动补一个换行；相同周期会覆盖同一 summary 文件。

## 工作目录和输出

```text
~/.weekly-git-report/
  config.json
  projects.json

{outputRoot}/
  raw/{YYYY}/{MM}/{start}_{end}/
    index.md
    manifest.json
    {project}.md
  summary/{YYYY}/{MM}/{start}_{end}.md
```

## 安全边界

- raw 读取和 summary 写入都会校验目标路径位于配置的 `outputRoot` 内。
- `read_week_raw` 只读取 manifest 声明的 Markdown 文件。
- 工具拒绝访问解析后位于 `outputRoot` 之外的路径。

## 常见错误

| 错误                        | 处理方式                                         |
| --------------------------- | ------------------------------------------------ |
| 配置不存在                  | 执行 `npx -y @weekly-git-report/cli@latest init` |
| 项目索引不存在              | 调用 `scan_projects`                             |
| raw 文件不存在              | 先调用 `collect_git_logs`，并确认周期完全一致    |
| 日期校验失败                | 使用 `YYYY-MM-DD` 格式                           |
| 作者为空且 Git 用户名不可用 | 在配置或 `author` 参数中显式指定作者             |

## 依赖关系

本包只保留 MCP 注册和响应包装，业务流程复用私有的 `@weekly-git-report/workflow`。发布时内部包会被打入 `dist`。
