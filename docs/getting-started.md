# 入门指南

Weekly Git Report 可以通过 Desktop、CLI、MCP 或 Agent Skill 使用。第一次使用推荐从 Desktop 开始；CLI 适合终端和自动化，MCP 与 Skill 需要先完成本地初始化。

## 选择入口

| 入口        | 推荐对象                               | 前置条件                              |
| ----------- | -------------------------------------- | ------------------------------------- |
| Desktop     | 希望通过图形界面完成全部日常操作的用户 | Windows x64、Git                      |
| CLI         | 终端用户、脚本和 CI                    | Node.js 22.12+、Git                   |
| MCP         | 使用支持 stdio MCP 的 Agent            | Node.js 22.12+、Git、已初始化的工作区 |
| Agent Skill | 使用支持本地 Skill 的 Agent            | Node.js 22.12+、Git、已初始化的工作区 |

无论选择哪种入口，仓库同步都使用本机 Git 与已有凭据。私有仓库应先确保 `git clone` 或 `git fetch` 能在终端中正常工作。

## Desktop

### 安装

从 [GitHub Releases](https://github.com/BINGWU2003/weekly-git-report/releases) 下载 `Weekly-Git-Report-Setup-<version>-x64.exe` 并安装。当前正式桌面包只提供 Windows x64 版本；开发模式和解压构建不启用自动更新。

### 首次设置

首次启动会进入引导流程：

1. **环境与目录**：检查 Git，选择报告目录和仓库缓存目录。两个目录不能相同、互相嵌套，也不能直接指向 `~/.weekly-git-report`。
2. **Git 作者身份**：确认用于筛选提交的姓名与邮箱。它们必须与提交中的作者信息完整匹配，但匹配时不区分大小写。
3. **仓库**：添加至少一个仓库，选择远程分支并完成首次同步。也可以扫描本地父目录批量导入已有开发仓库的 `origin`。
4. **AI**：选择 OpenAI 或 DeepSeek，保存 API 密钥并完成真实连接测试。模型和生成参数由应用管理。
5. **首份报告**：默认使用上一完整周，生成草稿后由你审核并保存。
6. **可选扩展**：按需配置飞书机器人或创建报告任务。

中途关闭不会丢失已经保存的步骤。完成后仍可从首次设置检查页查看环境状态。

### 日常生成

在报告库中选择报告类型：

- 日报：当天。
- 周报：本周一到今天。
- 月报：本月 1 日到今天。
- 自定义报告：手动选择起止日期，最长 366 天，可填写标题。

标准报告的日期由类型决定，不能手动修改。生成时会重新同步和采集；AI 内容先进入可编辑草稿，确认后才会保存到报告库。

## CLI

### 初始化

无需全局安装：

```sh
npx -y @weekly-git-report/cli@latest
```

在交互式菜单中完成初始化、添加仓库和 AI/飞书配置。也可以直接运行初始化命令：

```sh
npx -y @weekly-git-report/cli@latest init
```

完成后检查环境：

```sh
npx -y @weekly-git-report/cli@latest doctor
```

### 生成报告

CLI 的内置 AI、任务管理和 external-agent Run 都使用相同的工作流。外部 Agent 的最小流程为：

```sh
npx -y @weekly-git-report/cli@latest runs prepare --type weekly
npx -y @weekly-git-report/cli@latest runs complete RUN_ID --file ./weekly-report.md
```

只有本次明确需要推送飞书时才为 `runs complete` 添加 `--publish`。完整命令和 JSON 行为见 [CLI README](../packages/cli/README.md)。

## MCP

MCP 只负责外部 Agent 报告流程，不初始化配置、不管理仓库、不调用内置 AI，也不创建任务。请先通过 Desktop 或 CLI 完成本地设置。

配置 stdio server：

```json
{
  "mcpServers": {
    "weekly-git-report": {
      "command": "npx",
      "args": ["-y", "@weekly-git-report/mcp@latest"]
    }
  }
}
```

宿主应按以下顺序调用：

1. `prepare_report`
2. 使用返回的 `template` 和 `generationInput` 生成 Markdown
3. `complete_report`
4. 无法生成时调用 `fail_report`；已保存报告需要补推时调用 `publish_report`

详见 [MCP README](../packages/mcp/README.md)。

## Agent Skill

安装仓库内的 Skill：

```sh
npx skills add BINGWU2003/weekly-git-report
```

Skill 通过 CLI 执行 external-agent Run。它不会替你初始化、修改配置、读取采集数据文件或创建定时任务。具体权限和失败恢复规则见 [Skill 规约](../skills/weekly-git-report/SKILL.md)。

## 下一步

- 了解手动生成与定时任务为什么使用不同周期：[工作原理](how-it-works.md)。
- 查看配置和报告保存位置：[数据与存储](data-and-storage.md)。
- 了解发送给 AI 的字段和密钥保护方式：[安全与隐私](security.md)。
- 遇到同步或连接问题：[故障排查](troubleshooting.md)。
