---
name: weekly-git-report
description: Use when the user asks to generate, summarize, or save weekly reports from Git commit history using the weekly-git-report agent CLI.
---

# weekly-git-report

Use this skill when the user asks to generate or save a weekly report from Git commit history.

Do not use MCP for this workflow. Use `npx -y @weekly-git-report/agent-cli@latest` only when this skill is active.

## Workflow

1. Determine the report period as `YYYY-MM-DD` start and end dates.
2. If local config or project index is missing, ask the user to run `weekly init` and `weekly scan`, or run the matching `weekly-agent projects scan` command when roots are clear.
3. Collect raw Git records:

```sh
npx -y @weekly-git-report/agent-cli@latest collect --since YYYY-MM-DD --until YYYY-MM-DD --all
```

4. Read raw records:

```sh
npx -y @weekly-git-report/agent-cli@latest raw read --start YYYY-MM-DD --end YYYY-MM-DD
```

5. Generate a Markdown summary based only on the raw records.
6. Save the summary by writing it to a temporary Markdown file and running:

```sh
npx -y @weekly-git-report/agent-cli@latest summary save --start YYYY-MM-DD --end YYYY-MM-DD --file PATH_TO_SUMMARY_MD
```

7. Tell the user the saved summary path.

## Rules

- Do not fabricate work that is not present in the raw Git records.
- If commit messages are vague, state that the source data is vague.
- Do not use MCP tools for this workflow.
- Do not write summary files directly into `outputRoot`; use `summary save`.
- Keep the final response concise and include the saved summary path.

## Default Summary Format

```md
# 周报总结：YYYY-MM-DD ~ YYYY-MM-DD

## 本周完成

- ...

## 重点改动

- ...

## 问题与风险

- ...

## 下周建议

- ...
```
