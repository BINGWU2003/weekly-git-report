# @weekly-git-report/workflow

内部业务流程包，统一封装 MCP Server 和 Agent CLI 都需要的高层工作流。

## 发布状态

不发布到 npm。它是私有包，会被 `mcp` 和 `agent-cli` 的构建产物打包进去。

## 为什么存在

`mcp` 和 `agent-cli` 都需要执行相同业务流程：扫描项目、采集 raw、读取 raw、保存 summary。如果这些逻辑分别写在两个入口里，会造成重复维护。

`workflow` 负责把 `core` 的底层能力组合成稳定的业务函数，让入口层保持很薄。

## 调用关系

```text
mcp -> workflow -> core -> shared
agent-cli  -> workflow -> core -> shared
```

## 主要导出

```ts
import {
  listProjects,
  scanProjects,
  collectGitLogs,
  getWeekIndex,
  readWeekRaw,
  saveWeekSummary,
} from "@weekly-git-report/workflow";
```

## 输出约定

- `collectGitLogs` 写入 `{outputRoot}/raw/{YYYY}/{MM}/{start}_{end}/`。
- `readWeekRaw` 读取 manifest 中登记的项目 Markdown。
- `saveWeekSummary` 写入 `{outputRoot}/summary/{YYYY}/{MM}/{start}_{end}.md`。
- 读写路径会限制在 `outputRoot` 内。

## 开发命令

```sh
pnpm --filter @weekly-git-report/workflow check-types
pnpm --filter @weekly-git-report/workflow lint
pnpm --filter @weekly-git-report/workflow build
```
