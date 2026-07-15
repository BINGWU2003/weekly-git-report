# @weekly-git-report/core

内部核心能力包，封装配置、路径、Git 扫描、提交采集和报告写入等底层逻辑。

## 发布状态

不发布到 npm。公开包构建时会把它打包进最终产物。

## 职责

- 初始化和读取 `~/.weekly-git-report/config.json`。
- 扫描本地 Git 项目并生成 `projects.json`。
- 调用 Git 命令采集指定周期 commit。
- 生成 raw Markdown、`index.md` 和 `manifest.json`。
- 管理输出路径、幂等写入和可选历史备份。

## 不负责

- 不处理 CLI 参数解析。
- 不注册 MCP tools。
- 不决定 Agent 的周报总结格式。

这些逻辑由 `cli`、`mcp`、`agent-cli` 和 `workflow` 处理。

## 常用导出

```ts
import {
  initConfig,
  loadConfig,
  buildProjectIndex,
  collectCommits,
  writeReport,
} from "@weekly-git-report/core";
```

## 依赖关系

依赖 `@weekly-git-report/shared`。它被 `workflow` 和 `cli` 直接复用。

## 开发命令

```sh
pnpm --filter @weekly-git-report/core check-types
pnpm --filter @weekly-git-report/core lint
pnpm --filter @weekly-git-report/core build
```
