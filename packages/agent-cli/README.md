# @weekly-git-report/agent-cli

给 Agent Skill 按需调用的非交互 CLI。它不会常驻注册 MCP tools，适合只在生成周报时通过 `npx` 临时执行。

## 使用

```sh
npx -y @weekly-git-report/agent-cli@latest --help
npx -y @weekly-git-report/agent-cli@latest collect --since 2026-06-01 --until 2026-06-07 --all
npx -y @weekly-git-report/agent-cli@latest raw read --start 2026-06-01 --end 2026-06-07
npx -y @weekly-git-report/agent-cli@latest summary save --start 2026-06-01 --end 2026-06-07 --file summary.md
```

Skill 安装由 `@weekly-git-report/cli` 负责：

```sh
npx -y @weekly-git-report/cli@latest skill install
```
