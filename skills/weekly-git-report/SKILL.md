---
name: weekly-git-report
description: Generate and save weekly reports from explicitly configured Git commit history when the user asks for a Git-based 周报 or weekly work summary.
---

# weekly-git-report

根据 weekly-git-report 已配置仓库中的 Git 提交记录生成并保存周报。

只通过 `npx -y @weekly-git-report/cli@latest` 调用本地工作流，不使用 MCP，也不要扫描未配置的本地目录。

## 工作流程

1. 确定 `YYYY-MM-DD` 格式的开始日期和结束日期。
2. 如果全局配置或项目清单不存在，让用户在交互式终端运行 `npx -y @weekly-git-report/cli@latest` 完成配置。
3. 采集 Git 原始记录；`collect` 会先同步仓库：

```sh
npx -y @weekly-git-report/cli@latest collect --since YYYY-MM-DD --until YYYY-MM-DD --all
```

4. 读取该周期的 raw 文件：

```sh
npx -y @weekly-git-report/cli@latest raw read --start YYYY-MM-DD --end YYYY-MM-DD
```

5. 只依据返回的 raw Git 记录生成 Markdown 周报。提交信息不足时明确说明，不推断不存在的工作内容。
6. 将总结写入临时 Markdown 文件，再通过 CLI 保存：

```sh
npx -y @weekly-git-report/cli@latest summary save --start YYYY-MM-DD --end YYYY-MM-DD --file PATH_TO_SUMMARY_MD
```

7. 告诉用户命令返回的 `summaryFile` 保存路径。

如果同步或采集命令退出码非零或 JSON 中的 `errors` 不为空，停止总结失败项目，不要使用旧缓存补全内容。

## 保存约束

- 不要直接写入 `outputRoot`，必须使用 `summary save`，由工作流校验并计算安全路径。
- `summary save` 只负责保存已经生成的总结，不会调用 LLM。

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
