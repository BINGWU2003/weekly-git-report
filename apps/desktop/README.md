# Weekly Git Report Desktop

Weekly Git Report 的 Electron 桌面客户端，是普通用户的默认入口。它提供首次设置、仓库管理、AI 草稿生成、报告审核与浏览、飞书推送、系统定时任务和应用更新界面。

跨入口的完整说明见[项目文档](../../docs/README.md)。

## 平台与要求

- 正式安装包：Windows x64。
- 必需环境：Git。
- 正式安装包已经包含应用运行时，不要求用户单独安装 Node.js。
- 开发模式、解压构建以及 macOS/Linux 构建不启用自动更新。

从 [GitHub Releases](https://github.com/BINGWU2003/weekly-git-report/releases) 下载最新安装包。首次使用见[入门指南](../../docs/getting-started.md#desktop)。

## 功能

### 首次设置

- 检查 Git、报告目录和仓库缓存目录。
- 读取或填写用于筛选提交的 Git 作者身份。
- 添加并同步至少一个仓库。
- 配置 OpenAI、DeepSeek 或自定义 OpenAI-compatible 服务；也可以暂时跳过。
- 生成、审核并保存第一份报告。
- 中断后恢复已完成步骤和待审核草稿。
- 将飞书机器人和报告任务作为可选扩展。

### 仓库

- 添加、编辑、启停和同步显式配置的仓库。
- 读取远程分支并配置仓库专属作者身份。
- 扫描本地父目录，批量识别已有仓库的 `origin` 并建立独立缓存。
- 从本地缓存展示配置分支的最新提交，不在页面加载时访问远程 API。
- 删除仓库配置，并在多重路径校验和二次确认后选择性删除缓存。

### 报告

- 生成日报、周报、月报和最长 366 天的自定义报告。
- 使用明确选择的 AI 模型流式生成可编辑草稿。
- 在保存前审核草稿；报告任务可选择自动保存。
- 浏览报告正文（Summary）与采集数据（Raw），按类型、周期、角色和搜索词筛选。
- 预览 Markdown、查看原文、定位文件、恢复回收站报告。
- 校验关联信息文件（Sidecar）；异常报告仍可查看，但不能直接推送。
- 分别编辑四种报告模板，支持变量预览、恢复默认和 revision 冲突保护。

### 自动化与集成

- 配置 AI 服务、API Base URL、API Key 和模型；连接测试与保存相互独立。
- 配置全局飞书群自定义机器人，可选签名密钥。
- 创建日报、周报和月报任务，使用操作系统原生计划任务触发。
- 查看 ReportRun 执行记录、步骤状态、错误、Token 用量和待审核草稿。

### 更新

- Windows x64 正式安装包从 GitHub Releases 检查 stable 更新。
- 启动后延迟检查，并按周期静默检查；也可手动检查。
- 不自动下载，下载和安装都由用户确认。
- 报告正在生成、保存或推送时阻止安装。

更新发布规则见[Desktop 发布流程](../../docs/desktop-release.md)。

## 关键行为

- 手动日报使用当天，周报使用本周一至今天，月报使用本月 1 日至今天。
- 系统周报任务生成上一完整周，月报任务生成上一完整月。
- 自定义报告只用于临时手动生成，不进入报告任务。
- 飞书推送与保存方式分别配置；自动保存不代表一定推送。
- Desktop 启动不会自动同步全部仓库，生成报告或用户主动同步时才访问远程。

详见[工作原理](../../docs/how-it-works.md)。

## 配置与安全

Desktop 与 CLI 共用 `~/.weekly-git-report/` 下的配置、仓库、模板、任务和 Run 数据，也共用报告目录。

- 报告目录和缓存目录不能相同、互相嵌套或直接使用应用配置目录。
- 缓存目录在首次设置后由 Desktop 只读管理，避免已有仓库路径整体失效。
- AI 与飞书密钥保存在当前用户受限权限的本地 JSON，不使用系统 Keychain/DPAPI。
- 界面默认只显示掩码；用户明确查看某个字段时才读取该字段明文。
- Renderer 不直接访问 Node.js，只能调用沙箱 Preload 暴露的白名单 API。

文件布局见[数据与存储](../../docs/data-and-storage.md)，详细边界见[安全与隐私](../../docs/security.md)。

## 目录

```text
electron/main/       Electron 主进程、IPC、服务与更新
electron/preload/    暴露给 Renderer 的受限 Desktop API
shared/              Main、Preload、Renderer 共用的 IPC 类型
src/                 React Renderer、路由、功能页和组件
```

调用链和分层见[系统架构](../../docs/architecture.md#desktop-架构)。

## 开发

在 Monorepo 根目录执行：

```sh
pnpm install
pnpm --filter @weekly-git-report/desktop dev
```

验证和构建：

```sh
pnpm --filter @weekly-git-report/desktop check-types
pnpm --filter @weekly-git-report/desktop test
pnpm --filter @weekly-git-report/desktop build
pnpm --filter @weekly-git-report/desktop build:unpack
pnpm --filter @weekly-git-report/desktop build:win
```

更多信息见[开发指南](../../docs/development.md#desktop-开发)。
