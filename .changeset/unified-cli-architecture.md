---
"@weekly-git-report/cli": major
---

将 Agent 自动化命令合并到统一的 `weekly` CLI，并提供 `collect`、`raw`、`summary` 以及稳定 JSON 项目命令。新增从本地文件夹批量识别、同步和添加仓库的 `projects import`，项目查询和同步结果附带配置分支的本地最新提交状态。新增 `templates init/read/write/reset` 管理 CLI、Electron 与 Agent 共用的周报生成提示词。Agent Skill 改为通过通用 Skills CLI 从仓库安装，并通过 CLI 动态读取生成规则。
