# @weekly-git-report/core

Weekly Git Report 的内部领域与本地基础设施包。它只依赖 [`@weekly-git-report/shared`](../shared/README.md)，不提供用户命令，也不调用 AI、飞书或操作系统调度器。

## 职责

- 初始化、校验和原子更新全局配置与仓库索引。
- 使用 revision 与 expected revision 阻止并发静默覆盖。
- 规范化仓库 URL，计算默认缓存路径并检查重复配置。
- 创建裸仓库缓存、验证已有仓库 `origin` 并获取指定分支。
- 扫描本地仓库文件夹并构建批量导入候选。
- 按日期范围、分支和作者身份采集 Git 提交。
- 写入采集数据（Raw）项目 Markdown、`index.md` 和 `manifest.json`。
- 管理日报、周报、月报和自定义报告四种模板。
- 生成规范报告路径，索引报告正文并校验关联信息文件。
- 限制报告路径边界，提供安全删除和原子文件写入。

## 边界

- 所有持久化输入由 Shared 的 Zod Schema 校验。
- Git 同步使用配置的远程引用，不依赖工作区 `HEAD`。
- 仓库 URL 不允许内嵌凭据，已有缓存的 `origin` 必须匹配配置。
- Raw、Summary、历史和回收站路径必须位于配置的报告目录内。
- Core 只提供能力；完整 ReportRun、SQLite、AI、飞书与调度由 [`workflow`](../workflow/README.md) 编排。

## 主要入口

公开导出位于 `src/index.ts`。内部目录按能力划分为配置、仓库、采集器、报告、模板、写入器和通用路径/文件工具。

架构关系见[系统架构](../../docs/architecture.md#core本地领域能力)，文件行为见[数据与存储](../../docs/data-and-storage.md)。

## 开发

```sh
pnpm --filter @weekly-git-report/core check-types
pnpm --filter @weekly-git-report/core test
pnpm --filter @weekly-git-report/core build
```

该包是私有 workspace 包，由 CLI、MCP 和 Desktop 构建按各自方式引用或打包。
