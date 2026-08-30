# 故障排查

本页面向 Desktop 和 CLI 用户。Agent Skill 自身的失败恢复规则见 [`skills/weekly-git-report/references/error-recovery.md`](../skills/weekly-git-report/references/error-recovery.md)。

## 先运行环境检查

CLI 可以检查 Git、配置、仓库、模板和报告关联信息：

```sh
npx -y @weekly-git-report/cli@latest doctor
```

Desktop 的总览和首次设置检查页会显示对应状态。处理具体错误前，先确认配置文件与报告目录仍然可访问。

## Git 不可用

现象：首次设置无法继续，或命令提示找不到 Git。

处理：

1. 在终端运行 `git --version`。
2. 安装 Git，或把 Git 可执行文件加入当前用户的 `PATH`。
3. 完全退出并重新打开 Desktop，让新环境变量生效。
4. 私有仓库还应在同一用户会话中验证 `git ls-remote <url>`。

## 没有检测到作者身份

系统按提交的作者姓名或邮箱筛选，不是按当前操作系统账户筛选。

可以查看 Git 全局配置：

```sh
git config --global user.name
git config --global user.email
```

首次设置中可以手动填写身份。仓库还可以配置专属身份，专属身份会覆盖全局身份。匹配使用完整姓名或完整邮箱，不区分大小写。

## 仓库无法同步

依次检查：

1. 仓库 URL 是否正确，且没有内嵌密码或 Token。
2. 系统 Git 是否能使用 SSH Agent 或凭据管理器访问远程。
3. 配置分支是否存在。
4. 缓存目录中的 `origin` 是否仍与配置 URL 一致。
5. 代理、DNS 或企业网络是否阻止 Git 访问。

单个仓库失败时其他仓库仍会完成同步，但本次完整报告 Run 会停止，避免使用不完整事实生成报告。

## 文件夹导入没有发现仓库

文件夹扫描最多递归 4 层、识别 200 个仓库，并且不跟随符号链接。候选仓库必须存在可读取的 `origin`。

已配置仓库、同一批次中的重复远程、没有 `origin` 或远程检查失败的仓库会跳过。导入不会直接使用或修改开发工作区，而是建立独立缓存。

## 报告中缺少提交

确认：

- 仓库已启用。
- 采集分支与提交实际所在分支一致。
- 报告日期覆盖提交的 `committedAt`。
- 作者姓名或邮箱与提交元数据完整匹配。
- 同步没有项目级错误。

手动周报是本周一到今天，系统周报任务生成上一完整周；不要把两种周期语义混淆。

## 周期内没有匹配提交

系统会在调用 AI 前提示空周期。可以：

- 更换报告类型或自定义日期后重新采集。
- 检查作者身份和仓库分支。
- 明确继续生成空周期报告，让模板如实说明没有匹配提交。

## AI 无法连接

1. 确认选择了正确供应商。
2. 重新输入 API 密钥并保存测试。
3. 检查网络、代理、账户额度和供应商服务状态。
4. 如果保存成功但测试失败，配置仍会保留；修复网络或密钥后点击重新测试。

应用不自动重试或切换到另一个供应商。OpenAI 与 DeepSeek 的模型和生成参数由当前应用版本管理。

## 飞书无法连接或推送

配置阶段：

- 确认使用群自定义机器人的完整 Webhook。
- 机器人启用了签名时填写对应签名密钥。
- 保存后执行连接测试。

推送阶段：

- 只有报告正文与 Sidecar 哈希一致时才能发送。
- 报告过大时会失败，不会自动截断。
- `publish_failed` 表示本地报告已经保存，只需修复飞书配置后重试推送，不要重新保存报告。

## 报告信息异常或要求确认覆盖

常见原因：

- 同名 Markdown 是手动创建的，没有 `.meta.json`。
- Sidecar 内容不符合当前 Schema。
- Sidecar 记录的正文哈希与文件实际内容不同。
- 现有报告类型或来源与本次保存不一致。

先在报告库查看或备份原文件。确认要替换后，Desktop 可选择“覆盖并保存”；CLI/MCP 只有新 Run 的首次完成操作才能使用 `force`。旧正文和 Sidecar 会先备份到相邻 `.history/`。

`force` 不能绕过 generation input、模板或 Raw manifest 完整性错误。

## Run 一直排队或无法继续

系统同一时间只允许一个 Run 处于采集或生成活动槽位。先在“执行记录”中检查是否有仍在采集、生成或等待审核的 Run。

CLI 可以查询和取消：

```sh
npx -y @weekly-git-report/cli@latest runs list
npx -y @weekly-git-report/cli@latest runs show RUN_ID
npx -y @weekly-git-report/cli@latest runs cancel RUN_ID
```

不要取消正在保存或推送的 Run。外部 Agent 只预览不保存时，应在展示结果后取消本次仍处于 `generating` 的 Run。

## 定时任务没有运行

1. 确认任务已启用，并查看界面显示的星期、日期和本地时间。
2. 检查系统原生调度器中是否存在对应任务。
3. 确认创建任务时使用的应用或 CLI 路径仍然存在。
4. 确认系统账户在触发时可以访问 Git 凭据、网络和报告目录。
5. 先使用“立即执行”验证报告配置，再重新同步系统调度。

定时任务不是后台轮询服务。Windows 使用 Task Scheduler，macOS 使用 `launchd`，Linux 使用用户级 `systemd timer`。

## Desktop 无法检查或安装更新

自动更新只支持 Windows x64 已安装正式包。以下环境会禁用更新：

- 开发模式。
- 解压构建。
- macOS 或 Linux 构建。

更新不会自动下载。报告正在生成、保存或推送时，立即安装和退出安装都会被阻止。可以在“关于与更新”重新检查、下载或打开发布页面。

## MCP 或 Skill 提示尚未初始化

MCP 与 Skill 不会创建配置或添加仓库。请先：

1. 使用 Desktop 完成首次设置；或运行 `npx -y @weekly-git-report/cli@latest`。
2. 添加并启用至少一个仓库。
3. 使用 `doctor` 验证本地环境。

MCP 不要求配置内置 AI；生成由 MCP 宿主 Agent 完成。只有需要推送时才要求飞书配置已经测试成功。

## 仍然无法解决

保留以下信息用于排查，但不要公开密钥：

- 操作入口和完整命令。
- ReportRun ID、状态和错误代码。
- `doctor` 输出。
- 操作系统、Node.js、Git 和 Desktop 版本。
- 失败仓库的名称与分支，不要复制带凭据的 URL。
