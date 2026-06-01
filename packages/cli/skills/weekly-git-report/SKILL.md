---
name: weekly-git-report
description: Use when the user asks to generate, summarize, or save weekly reports / 周报总结 from Git commit history using the weekly-git-report agent CLI.
---

# weekly-git-report

当用户要求根据 Git 提交记录生成、整理或保存周报时使用本 Skill。

本流程不要使用 MCP。只有在本 Skill 被触发时，才通过 `npx -y @weekly-git-report/agent-cli@latest` 临时调用命令。

## 工作流程

1. 确定周报周期，格式为 `YYYY-MM-DD` 的开始日期和结束日期。
2. 如果本地配置或项目索引不存在，先让用户执行 `weekly init` 和 `weekly scan`；如果 roots 明确，也可以执行 `weekly-agent projects scan`。
3. 采集 Git 原始记录：

```sh
npx -y @weekly-git-report/agent-cli@latest collect --since YYYY-MM-DD --until YYYY-MM-DD --all
```

4. 读取 raw 原始记录：

```sh
npx -y @weekly-git-report/agent-cli@latest raw read --start YYYY-MM-DD --end YYYY-MM-DD
```

5. 只基于 raw 原始记录生成 Markdown 周报总结。
6. 将总结内容写入临时 Markdown 文件，然后保存 summary：

```sh
npx -y @weekly-git-report/agent-cli@latest summary save --start YYYY-MM-DD --end YYYY-MM-DD --file PATH_TO_SUMMARY_MD
```

7. 告诉用户 summary 的保存路径。

## 规则

- 不要编造 raw Git 记录中不存在的工作内容。
- 如果 commit message 太模糊，要明确说明原始信息不足，不要过度推断。
- 不要使用 MCP tools。
- 不要手动写入 `outputRoot` 目录，必须使用 `summary save`。
- 最终回复保持简洁，并包含 summary 保存路径。

## 默认总结格式

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
