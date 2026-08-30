# 开发指南

本页说明 Monorepo 的本地开发、验证和构建方式。业务分层见[系统架构](architecture.md)，Windows 安装包发布见[Desktop 发布与更新演练](desktop-release.md)。

## 环境

- Node.js 22.12+
- pnpm 10.25.0（以根 `package.json` 的 `packageManager` 为准）
- Git
- 构建 Desktop Windows 安装包时需要 Windows 环境

## 安装依赖

```sh
pnpm install
```

CI 和可重复构建使用：

```sh
pnpm install --frozen-lockfile
```

项目使用 pnpm workspace 管理 `apps/*` 与 `packages/*`，Turborepo 根据依赖关系安排构建、测试和类型检查。

## 常用命令

| 命令                | 作用                              |
| ------------------- | --------------------------------- |
| `pnpm format`       | 使用 Oxfmt 修复格式               |
| `pnpm format:check` | 检查格式但不修改文件              |
| `pnpm lint`         | 使用 Oxlint 并把 warning 视为失败 |
| `pnpm test`         | 运行各 workspace 测试             |
| `pnpm check-types`  | 运行 TypeScript 类型检查          |
| `pnpm build`        | 按依赖顺序构建全部 workspace      |
| `pnpm dev`          | 启动支持开发模式的 workspace      |

提交前推荐依次运行：

```sh
pnpm format:check
pnpm test
pnpm lint
pnpm check-types
pnpm build
```

如果修改了格式，先运行 `pnpm format`，再重新检查。

## 按包运行

使用 pnpm filter 缩小验证范围：

```sh
pnpm --filter @weekly-git-report/shared build
pnpm --filter @weekly-git-report/core test
pnpm --filter @weekly-git-report/workflow check-types
pnpm --filter @weekly-git-report/cli build
pnpm --filter @weekly-git-report/mcp build
```

部分包的测试或运行时入口依赖已构建的 workspace 产物。直接运行单包命令遇到无法解析内部包时，先构建其依赖，或使用根目录的 Turbo 命令。

## Desktop 开发

启动开发环境：

```sh
pnpm --filter @weekly-git-report/desktop dev
```

验证与构建：

```sh
pnpm --filter @weekly-git-report/desktop check-types
pnpm --filter @weekly-git-report/desktop test
pnpm --filter @weekly-git-report/desktop build
pnpm --filter @weekly-git-report/desktop build:unpack
pnpm --filter @weekly-git-report/desktop build:win
```

Node 主进程和 React Renderer 使用独立 TypeScript 配置。浏览器组件测试由 Vitest Browser Mode 与 Playwright Chromium 运行。

## CLI 与 MCP 开发

构建后直接运行 CLI：

```sh
pnpm --filter @weekly-git-report/cli build
node packages/cli/dist/index.js --help
```

MCP 是 stdio server，调试时不要向 stdout 写入协议以外的日志：

```sh
pnpm --filter @weekly-git-report/mcp build
node packages/mcp/dist/index.js
```

CLI 和 MCP 的发布构建会把私有 workspace 包打进最终产物。Core、Workflow、Shared 和 TypeScript Config 不单独发布到 npm。

## 测试策略

- `shared`：Schema、类型和常量由使用方类型检查及单元测试覆盖。
- `core`：Git、配置、模板、路径、采集和文件写入单元/集成测试。
- `workflow`：ReportRun、SQLite 状态、AI/飞书边界、调度和保存一致性测试。
- `cli`：命令解析、TTY/JSON 行为和退出码测试。
- `mcp`：工具注册、输入校验和 workflow 委托测试。
- `desktop`：主进程服务测试与 Renderer 浏览器组件测试。

新增行为应优先在拥有规则的最低层测试，适配器再覆盖参数映射和用户交互，避免在每个入口重复同一业务测试。

## CI

CI 使用 Node.js 22.12 和 Node.js 24：

- Ubuntu 上运行格式、测试、Lint 和类型检查。
- Ubuntu、Windows、macOS 分别执行全仓构建。
- `fail-fast` 关闭，使平台或 Node.js 版本问题可以一次完整展示。

Desktop 正式发布工作流使用 Node.js 24，并在 Windows 构建 NSIS x64 安装包。

## 版本与发布

项目使用 Changesets：

```sh
pnpm changeset
pnpm version-packages
pnpm release
```

- CLI 和 MCP 发布到 npm。
- Desktop 是私有 workspace 包，但版本与 Tag 用于 GitHub Release。
- Core、Workflow、Shared 和 TypeScript Config 是私有内部包。
- Desktop 是当前唯一创建 GitHub Release 的产品，避免 electron-updater 把 CLI/MCP Release 识别为桌面更新。

涉及 Desktop 用户可见行为的变化应添加 Desktop Changeset，即使实现位于 Core 或 Workflow。完整发布和升级演练见 [Desktop 发布与更新演练](desktop-release.md)。

## 文档维护

- 根 README 只保留产品定位、最短上手和文档导航。
- 跨入口概念写在 `docs/`，不要复制到每个包 README。
- 包 README 只记录该模块的安装、命令/API、边界和开发入口。
- 用户界面使用“报告正文、采集数据、关联信息、执行记录”；技术文档首次出现时可附 Summary、Raw、Sidecar、ReportRun。
- Mermaid 图应描述稳定的模块或状态关系，不使用易漂移的源码行号。
- Skill 是 Agent 执行规约，不应改写成普通用户教程。
