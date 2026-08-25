# @weekly-git-report/agent-cli

面向 Agent 和脚本的非交互 JSON CLI。首次配置请运行 `@weekly-git-report/cli`。

## 命令

```text
weekly-agent projects list
weekly-agent projects sync [--project <id-or-name>] [--all]
weekly-agent collect --since <YYYY-MM-DD> --until <YYYY-MM-DD> [--author <name-or-email>] [--project <id-or-name>] [--all]
weekly-agent raw index --start <YYYY-MM-DD> --end <YYYY-MM-DD>
weekly-agent raw read --start <YYYY-MM-DD> --end <YYYY-MM-DD>
weekly-agent summary save --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--file <path>]
```

`projects list` 直接读取显式项目配置。`projects sync` fetch 指定分支。`collect` 会自动同步选中项目，然后从 `origin/<branch>` 采集提交；`--author` 可以按准确姓名或邮箱临时覆盖配置身份。

正常结果写入 stdout JSON，可预期错误写入 stderr 并设置退出码 `1`。单个项目同步或采集失败记录在 `errors` 中，不中断其他项目。
