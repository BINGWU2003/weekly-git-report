# @weekly-git-report/shared

内部共享包，集中维护常量、Zod schema 和 TypeScript 类型。

## 发布状态

不发布到 npm。公开包构建时会把它打包进最终产物。

## 内容

- 默认配置常量：`DEFAULT_CONFIG`、`DEFAULT_OUTPUT_ROOT`。
- 目录和文件名常量：`WORK_DIR`、`RAW_DIR_NAME`、`SUMMARY_DIR_NAME` 等。
- Zod schema：配置、项目索引、采集参数、MCP/Agent 输入等。
- 类型导出：由 schema 推导的 `Config`、`Project`、`Manifest`、`Period` 等。

## 常用导出

```ts
import {
  ConfigSchema,
  CollectGitLogsInputSchema,
  SaveWeekSummaryInputSchema,
} from "@weekly-git-report/shared";
import type { Config, Period } from "@weekly-git-report/shared";
```

## 依赖关系

只依赖 `zod`。它位于依赖链底层，被 `core`、`workflow`、`cli`、`mcp` 和 `agent-cli` 复用。

## 开发命令

```sh
pnpm --filter @weekly-git-report/shared check-types
pnpm --filter @weekly-git-report/shared lint
pnpm --filter @weekly-git-report/shared build
```
