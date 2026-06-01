# @weekly-git-report/agent-cli

给 Agent Skill 按需调用的非交互 CLI。它不会常驻注册 MCP tools，适合只在生成周报时通过 `npx` 临时执行。

## 使用

```sh
npx -y @weekly-git-report/agent-cli@latest --help
npx -y @weekly-git-report/agent-cli@latest collect --since 2026-06-01 --until 2026-06-07 --all
npx -y @weekly-git-report/agent-cli@latest raw read --start 2026-06-01 --end 2026-06-07
npx -y @weekly-git-report/agent-cli@latest summary save --start 2026-06-01 --end 2026-06-07 --file summary.md
```

## 安装 Skill

在任意项目中执行：

```sh
npx -y @weekly-git-report/agent-cli@latest skill install
```

这会创建：

```text
.opencode/skills/weekly-git-report/SKILL.md
```

安装后重启 opencode，让 Skill 生效。
