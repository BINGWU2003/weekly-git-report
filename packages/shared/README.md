# @weekly-git-report/shared

Weekly Git Report 的内部跨层契约包，集中维护常量、Zod Schema、稳定 DTO 和由 Schema 推导的 TypeScript 类型。

## 内容

- 默认工作目录、报告目录、缓存目录和文件名常量。
- 全局配置、仓库配置和作者身份 Schema。
- 日期范围、日报/周报/月报/自定义报告类型与任务节奏。
- 采集参数、Raw manifest 和报告索引 DTO。
- 四种报告模板、模板 revision 与渲染结果。
- 结构化 generation input 与报告 Sidecar Schema。
- ReportRun、运行步骤、Token 用量和错误结构。
- AI、飞书、报告任务和 MCP 输入 Schema。
- Desktop、CLI 和 MCP 需要共享的稳定类型。

## 设计原则

- Schema 是运行时验证与 TypeScript 类型的共同来源。
- Shared 只依赖 Zod，不执行文件、Git、SQLite 或网络操作。
- 它位于依赖链底部，被 Core、Workflow、CLI、MCP 和 Desktop 使用。
- 新持久化结构应先在这里定义和验证，再由上层实现行为。

## 使用示例

```ts
import { ConfigSchema, PrepareReportInputSchema, ReportRunSchema } from "@weekly-git-report/shared";
import type { Config, Period, ReportType } from "@weekly-git-report/shared";
```

实际导出以 `src/index.ts` 为准。跨层关系见[系统架构](../../docs/architecture.md#shared跨层契约)。

## 开发

```sh
pnpm --filter @weekly-git-report/shared check-types
pnpm --filter @weekly-git-report/shared build
```

该包不单独发布到 npm；CLI 与 MCP 的发布构建会将其打入最终产物。
