# Weekly Git Report Desktop

Windows Electron 客户端。桌面端与 CLI 共用 `~/.weekly-git-report/config.json` 和
`projects.json`，直接调用本机 Git，并在 `config.outputRoot` 下浏览现有 Markdown 报告。

## 当前能力

- 总览本机 Git、共享配置、仓库数量和报告数量。
- 查看 `projects.json` 中的仓库、分支、作者与缓存目录。
- 扫描 `outputRoot` 下的 Markdown，支持渲染预览、源码查看和资源管理器定位。
- 查看共享的全局配置和桌面外观设置。
- 通过沙箱 Preload 暴露白名单 IPC，Renderer 不直接访问 Node.js。

报告任务、SQLite 调度、LLM 和飞书推送尚在后续阶段。

## 开发

在 monorepo 根目录执行：

```sh
pnpm install
pnpm --filter @weekly-git-report/desktop dev
```

质量检查和构建：

```sh
pnpm --filter @weekly-git-report/desktop check-types
pnpm --filter @weekly-git-report/desktop test
pnpm --filter @weekly-git-report/desktop build
pnpm --filter @weekly-git-report/desktop build:win
```

## 目录

```text
electron/main/       主进程、IPC 和本地服务
electron/preload/    白名单 Desktop API
shared/              Main、Preload、Renderer 共用的 IPC 类型
src/                 React Renderer
```

原始 UI 基于 Shadcn Admin Dashboard 模板进行二次开发，通用 Shadcn/Radix 组件、主题、
TanStack Router、React Query 和测试基础设施继续保留。
