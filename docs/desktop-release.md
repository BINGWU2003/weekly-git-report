# Desktop 发布与更新演练

Desktop 是当前仓库唯一创建 GitHub Release 的产品。CLI 和 MCP 继续发布 npm 包并保留 Git Tag/Changelog，但不要为它们创建 GitHub Release，否则 `electron-updater` 可能把不相关版本识别为 Latest Release。

## 正式发布

1. 所有用户可见的 Desktop 行为变化都添加 `@weekly-git-report/desktop` Changeset；即使实现位于 `core` 或 `workflow` 也一样。
2. 合并 Changesets 创建的发布 PR。Desktop 首个正式版本为 `1.0.0`，Tag 格式为 `@weekly-git-report/desktop@1.0.0`。
3. Release 工作流先完成全仓格式、测试、Lint、类型和构建门禁。Changesets 发布 npm 包并创建 Tag 后，Windows Job 构建 NSIS x64 安装包。
4. Windows Job 校验 `.exe`、`.blockmap`、`latest.yml` 的版本和文件名，生成 `SHA256SUMS.txt`，再创建 Draft Release 并上传资产。
5. 远端资产名称和大小校验通过后才将 Draft 发布为 Latest Release。版本说明直接读取 `apps/desktop/CHANGELOG.md` 对应版本，默认使用简体中文。

发布资产包括：

- `Weekly-Git-Report-Setup-<version>-x64.exe`
- `Weekly-Git-Report-Setup-<version>-x64.exe.blockmap`
- `latest.yml`
- `SHA256SUMS.txt`

如果 npm 已发布但 Desktop Job 失败，不回滚 npm。Draft Release 和 Actions Artifact 会保留用于排查；修复发布流程后，在 Release 工作流中填写同一 Desktop Tag 手动重跑。已发布 Release 不允许用同版本覆盖。

如果已发布版本存在严重问题，撤下对应 Release，并通过 Changeset 发布更高版本修复；不要覆盖同版本资产，也不要自动降级客户端。

## `0.9.0 → 1.0.0` 真实升级演练

正式发布 `1.0.0` 前，在独立测试仓库或临时 Release 环境完成一次真实升级：

1. 将 Desktop 测试版本设为 `0.9.0`，使用与正式版一致的 NSIS 当前用户安装配置构建并安装。
2. 准备 `1.0.0` Draft 的 `.exe`、`.blockmap` 和 `latest.yml`，确认 feed 中的 `version`、`path`、SHA512 与资产一致后发布为 Latest。
3. 启动已安装的 `0.9.0`，等待约 15 秒或手动检查，确认只显示非阻塞更新提醒，不自动下载。
4. 在“关于与更新”确认 Release Notes、GitHub 链接和日志入口；手动下载并观察进度。
5. 分别验证“立即重启安装”和“正常退出后安装”。创建一个正在生成的报告时，两条安装路径都必须被阻止。
6. 安装后确认版本为 `1.0.0`，配置、仓库、报告、任务、AI/飞书配置均保留，且可以从 `0.9.0` 直接升级到 Latest Stable。
7. 删除测试 Release/测试仓库资产；不要把 `0.9.0` 测试 Release 留在正式仓库成为 Latest。

首版允许未签名安装包。接入 Windows 代码签名后，应在同一演练中增加签名校验和 SmartScreen 行为验证。
