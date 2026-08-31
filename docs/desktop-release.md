# Desktop 发布流程

Desktop 是当前仓库唯一创建 GitHub Release 的产品。CLI 和 MCP 继续发布 npm 包并保留 Git Tag/Changelog，但不要为它们创建 GitHub Release，否则 `electron-updater` 可能把不相关版本识别为 Latest Release。

## 正式发布

1. 所有用户可见的 Desktop 行为变化都添加 `@weekly-git-report/desktop` Changeset；即使实现位于 `core` 或 `workflow` 也一样。
2. 合并 Changesets 创建的发布 PR。Desktop Tag 格式为 `@weekly-git-report/desktop@<version>`。
3. Release 工作流先完成全仓格式、测试、Lint、类型和构建门禁。Changesets 发布 npm 包并创建 Tag 后，Windows Job 构建 NSIS x64 安装包。
4. Windows Job 校验 `.exe`、`.blockmap`、`latest.yml` 的版本和文件名，把 Desktop Release 标题与说明写入 `latest.yml`，生成 `SHA256SUMS.txt`，再创建 Draft Release 并上传资产。显式写入元数据可避免 GitHub Atom feed 中带 `/` 的 workspace Tag 被 `electron-updater` 误认为 Desktop 版本说明。
5. 远端资产名称和大小校验通过后才将 Draft 发布为 Latest Release。版本说明直接读取 `apps/desktop/CHANGELOG.md` 对应版本，默认使用简体中文。

发布资产包括：

- `Weekly-Git-Report-Setup-<version>-x64.exe`
- `Weekly-Git-Report-Setup-<version>-x64.exe.blockmap`
- `latest.yml`
- `SHA256SUMS.txt`

如果 npm 已发布但 Desktop Job 失败，不回滚 npm。Draft Release 和 Actions Artifact 会保留用于排查；修复发布流程后，在 Release 工作流中填写同一 Desktop Tag 手动重跑。已发布 Release 不允许用同版本覆盖。

如果已发布版本存在严重问题，撤下对应 Release，并通过 Changeset 发布更高版本修复；不要覆盖同版本资产，也不要自动降级客户端。
