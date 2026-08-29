# Weekly Git Report Desktop

Electron 桌面客户端。桌面端与 CLI 共用 `~/.weekly-git-report/config.json` 和
`projects.json`，直接调用系统 Git 和本机凭据，并在 `config.outputRoot` 下浏览现有
Markdown 报告。

## 当前能力

- 未完成首次设置时自动进入单页六步引导：环境与目录、Git 作者身份、仓库、AI、首份报告、可选扩展，无需先运行 CLI。
- 至少一个启用仓库、AI 连接测试和首份报告审核保存是必要步骤；当前会话可暂时进入工作台，下次启动会继续引导。
- 初始化运行 ID 保存在 `desktop-onboarding.json`，页面刷新后可以恢复待审核草稿；完成后 `/setup` 保留只读检查清单。
- 启动时非破坏性补齐缺失的空仓库索引、报告目录和生成模板，不覆盖已有内容。
- 编辑报告目录、空仓库策略和全局 Git 作者身份。
- 分别编辑 CLI 与 Agent 共用的日报、周报、月报、自定义报告生成提示词，支持变量预览、恢复默认和 revision 冲突保护。
- 添加、编辑、启停和同步仓库，支持远程分支读取和仓库专属作者身份。
- 从本地父目录递归识别多个仓库，预览默认配置并批量同步添加。
- 从本地缓存展示每个采集分支的最新提交，不在页面加载时访问远程。
- 删除仓库配置，并可在绝对路径二次确认后安全删除 Bare Git 缓存。
- 总览本机 Git、共享配置、仓库数量和报告数量。
- 只索引 `outputRoot` 下规范的 `summary` 和 `raw` 报告目录，排除临时文件与其他 Markdown。
- 报告库支持类型、Summary 报告类型（含自定义报告）、周期预设、自定义日期、Raw 角色和语义搜索筛选，并按报告周期折叠分组。
- 标准报告手动生成当前周期，自定义报告使用日历选择最多 366 天；首次报告默认上一完整周。空周期会在调用 AI 前停止，用户可以更换周期或明确继续生成。
- 从 Raw manifest 读取仓库名称、周期和生成时间；Raw 元数据损坏时停止展示。Summary Sidecar 缺失或损坏时保留 Markdown 并显示“元数据异常”。
- 支持 Markdown 渲染预览、源码查看和资源管理器定位，Raw 历史版本默认隐藏。
- 通过独立的“AI 与推送”设置页管理 OpenAI、DeepSeek 和飞书机器人配置；敏感值默认掩码，只有手动查看时才按字段读取明文。
- 设置桌面端外观。
- 通过沙箱 Preload 暴露白名单 IPC，Renderer 不直接访问 Node.js。
- 配置并测试 OpenAI 或 DeepSeek，流式生成可编辑草稿，审核后保存 Summary。
- 配置一个全局飞书群机器人，对有效 Summary 手动推送或随自动任务推送。
- 创建日报、周报和月报任务，通过系统原生调度运行；日报生成当天，周一生成上一完整周，每月 1 日生成上一完整月。自定义报告不进入任务。

## 配置说明

- 报告输出目录可以手动输入或通过目录选择器设置；修改后不会迁移旧报告。
- `repositoryCacheRoot` 用于存放只读取 Git 日志的 Bare 仓库。初始化时可手动输入或选择，初始化完成后在桌面端只读，避免已有仓库路径整体失效。
- 报告目录和缓存目录不能相同、互相嵌套，也不能直接使用 `~/.weekly-git-report` 应用配置目录。
- 桌面端保存配置时会校验共享 Schema，并检测配置是否在此期间被 CLI 或其他窗口修改。
- Git 不可用时会阻止继续；未检测到全局身份时可以手动填写。四套模板在创建工作区时自动就绪，不要求首次逐个编辑。
- AI 与飞书密钥保存在当前用户可访问、受文件 ACL 保护的本地 JSON 中，并非系统 Keychain/DPAPI；界面不会回显或写入日志。
- 生成模板分别保存在 `~/.weekly-git-report/templates/{daily,weekly,monthly,custom}/summary.md`，不会写入 `config.json` 或报告输出目录。
- 仓库 URL 添加后不可直接修改，需要移除旧配置后重新添加。
- 桌面端启动时不会自动同步仓库，可按需同步单个仓库或全部已启用仓库。
- 文件夹导入只读取源仓库的 `origin`，不会把开发工作区作为缓存，也不会修改或删除源目录。
- 最新提交是最后一次成功同步后的本地缓存状态；同步失败时旧提交会标记为可能过期。
- 报告筛选条件保存在路由查询参数中；默认展示最近三个月，周期有重叠即视为命中。
- AI API Key、飞书 Webhook 和签名密钥仍保存在仅当前系统用户可访问的本地配置文件中。桌面端状态接口只返回掩码，未修改的敏感字段在保存时保持原值。

## 开发

在 monorepo 根目录执行：

```sh
pnpm install
pnpm --filter @weekly-git-report/desktop dev
```

质量检查和构建：

```sh
pnpm --filter @weekly-git-report/desktop check-types
pnpm --filter @weekly-git-report/desktop test
pnpm --filter @weekly-git-report/desktop build
pnpm --filter @weekly-git-report/desktop build:win
```

## 目录

```text
electron/main/       主进程、IPC 和本地服务
electron/preload/    白名单 Desktop API
shared/              Main、Preload、Renderer 共用的 IPC 类型
src/                 React Renderer
```

原始 UI 基于 Shadcn Admin Dashboard 模板进行二次开发，通用 Shadcn/Radix 组件、主题、
TanStack Router、React Query 和测试基础设施继续保留。
