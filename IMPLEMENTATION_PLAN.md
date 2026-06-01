# weekly-git-report Implementation Plan

本文档基于 `requirement.md` 拆分实施步骤。项目按阶段推进，每个阶段完成后先验收，再进入下一阶段。

## 总体原则

- 第一版优先交付 CLI 能力：`weekly init`、`weekly scan`、`weekly list`、`weekly collect`。
- MCP Server 作为第二阶段实现，但第一版保留 monorepo 包结构。
- 所有外部输入必须经过 Zod 校验，包括配置、CLI 参数、项目索引、采集参数、manifest。
- 工具工作目录固定为 `~/.weekly-git-report/`，第一版不支持自定义。
- 周报原始记录输出目录由 `config.json` 的 `outputRoot` 控制，第一版不支持 `weekly collect --output`。
- 采集结果默认覆盖写入，禁止追加写入和生成重复副本文件。
- 每阶段验收命令通过后，再进入下一阶段。

## 阶段 0：项目骨架调整

### 目标

把当前 Turborepo starter 调整为后续实现所需的 Node.js + TypeScript monorepo 基础结构。

### 主要任务

- 新增 `packages/shared`，放置常量、类型和 Zod schemas。
- 新增 `packages/core`，放置配置、路径、Git、扫描、采集、写入和 manifest 逻辑。
- 新增 `packages/cli`，放置 CLI 入口和命令定义。
- 预留 `packages/mcp-server` 目录结构，暂不实现完整 MCP 能力。
- 调整 workspace 依赖关系和 TypeScript 构建配置。
- 保留或移除 starter 中无关 app/package 时，以最小改动为原则。

### 交付物

- `packages/shared/package.json`
- `packages/shared/src/index.ts`
- `packages/core/package.json`
- `packages/core/src/index.ts`
- `packages/cli/package.json`
- `packages/cli/src/index.ts`
- 可选：`packages/mcp-server/package.json` 和空入口

### 验收

- 执行 `pnpm install` 成功。
- 执行 `pnpm check-types` 成功。
- 执行 `pnpm build` 成功。

## 阶段 1：Shared Schemas 与基础工具

### 目标

建立全项目共享的数据约束和基础工具能力，为 CLI、core、MCP 复用。

### 主要任务

- 定义 `ConfigSchema`、`ProjectSchema`、`ProjectsIndexSchema`。
- 定义 `CollectOptionsSchema`、`PeriodSchema`、`ManifestSchema`。
- 定义 MCP tool 输入 schema 的基础结构，后续 MCP 阶段复用。
- 定义默认配置常量，包括 `WORK_DIR`、`CONFIG_FILE`、`PROJECTS_FILE`、默认 `outputRoot`、默认 `excludeDirs`。
- 实现路径工具：`~` 展开、绝对路径规范化、输出周期目录计算。
- 实现 Markdown 转义工具：处理表格中的 `|`、反引号和换行。

### 交付物

- `packages/shared/src/constants.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/types.ts`
- `packages/core/src/utils/path.ts`
- `packages/core/src/utils/markdown.ts`

### 验收

- 单独构建 `shared` 和 `core` 通过。
- Zod schema 能解析默认配置。
- 路径工具在 Windows 环境下能把 `~/weekly-reports` 解析为用户主目录下的绝对路径。

## 阶段 2：配置初始化与读取

### 目标

实现 `weekly init`，并建立所有非 init 命令依赖的配置读取能力。

### 主要任务

- 实现创建 `~/.weekly-git-report/`。
- 实现写入默认 `config.json`。
- 实现创建默认输出目录 `~/weekly-reports/raw` 和 `~/weekly-reports/summary`。
- 如果 `config.json` 已存在，不直接覆盖，输出提示。
- 实现配置读取、默认值合并和 Zod 校验。
- 非 `init` 命令在配置不存在时输出 `Config not found. Please run: weekly init`。

### 交付物

- `packages/core/src/config/defaults.ts`
- `packages/core/src/config/load-config.ts`
- `packages/core/src/config/init-config.ts`
- `packages/cli/src/commands/init.ts`

### 验收

- 执行 `weekly init` 后生成 `~/.weekly-git-report/config.json`。
- 默认配置包含 `outputRoot: "~/weekly-reports"`。
- 重复执行 `weekly init` 不覆盖已有配置。
- 删除或移动配置文件后，执行非 init 命令能提示先运行 `weekly init`。

## 阶段 3：Git 项目扫描与列表

### 目标

实现 `weekly scan` 和 `weekly list`，生成并读取 `projects.json`。

### 主要任务

- 递归扫描配置中的 `roots`。
- 支持 `.git` 目录和 `.git` 文件两种仓库识别方式。
- 支持 `excludeDirs` 和 `maxDepth`。
- 对每个 Git 项目读取 remote、branch、lastCommitAt。
- remote 不存在时用本地路径作为唯一标识。
- 同 remote 多路径时，保留最近活跃项目。
- 生成项目 `id`、`name`、`fileName`、`path`、`remote`、`branch`、`lastCommitAt`、`isDuplicate`。
- 写入 `~/.weekly-git-report/projects.json`。
- 实现 `weekly list` 读取并打印项目摘要。

### 交付物

- `packages/core/src/git/git-command.ts`
- `packages/core/src/scanner/find-git-projects.ts`
- `packages/core/src/scanner/build-project-index.ts`
- `packages/core/src/manifest/projects-index.ts`
- `packages/cli/src/commands/scan.ts`
- `packages/cli/src/commands/list.ts`

### 验收

- 给定包含 Git 仓库的 root，执行 `weekly scan` 生成 `projects.json`。
- `projects.json` 通过 `ProjectsIndexSchema` 校验。
- `weekly list` 能打印项目名、分支和 remote。
- 扫描不存在或不可访问的目录时不中断全部流程，并给出 warning。

## 阶段 4：Git Commit 采集

### 目标

实现 commit 采集核心能力，为 Markdown 输出做准备。

### 主要任务

- 实现 `weekly collect` 参数解析：`--since`、`--until`、`--author`、`--project`、`--all`、`--backup`。
- 第一版不实现 `--output`。
- 默认时间范围为本周一 00:00:00 到当前时间。
- author 优先级：CLI 参数 > config author > `git config user.name`。
- 对每个项目执行 `git log --since --until --author --pretty=format:"%cI%x1f%h%x1f%an%x1f%s"`。
- 解析 commit 输出为结构化数据。
- 项目采集失败时跳过当前项目，记录错误，继续处理其他项目。

### 交付物

- `packages/core/src/collector/resolve-period.ts`
- `packages/core/src/collector/resolve-author.ts`
- `packages/core/src/collector/collect-commits.ts`
- `packages/cli/src/commands/collect.ts`

### 验收

- 执行 `weekly collect --since 2026-06-01 --until 2026-06-07` 能完成项目遍历。
- 指定 `--author` 时 Git log 包含 author 过滤。
- 不指定 author 且配置为空时，能回退到 `git config user.name`。
- 单个项目 Git 命令失败不影响其他项目。

## 阶段 5：Markdown、Index 与 Manifest 输出

### 目标

完成第一版核心交付：按固定目录结构生成 Git 原始记录。

### 主要任务

- 根据 `outputRoot` 生成 `{outputRoot}/raw/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}/`。
- 每个有提交项目生成一个 Markdown 文件。
- `includeEmptyProjects` 为 true 时，为无提交项目生成 Markdown 文件。
- 生成周期 `index.md`。
- 生成 `manifest.json`。
- 计算项目 Markdown 的 `contentHash`，排除 `generatedAt` 和“采集时间”。
- 默认覆盖写入，不追加，不生成 `-1`、`-copy`、`-new` 文件。
- 实现 `--backup` 时覆盖前复制旧文件到 `.history`。
- 采集完成输出 Generated、Projects、Commits、Updated files、Skipped files、Errors。

### 交付物

- `packages/core/src/writer/project-markdown.ts`
- `packages/core/src/writer/index-markdown.ts`
- `packages/core/src/writer/manifest.ts`
- `packages/core/src/writer/write-report.ts`
- `packages/core/src/utils/hash.ts`

### 验收

- 执行 `weekly collect --since 2026-06-01 --until 2026-06-07` 后生成：`index.md`、`manifest.json`、项目 Markdown。
- 自定义 `outputRoot` 后，输出写入自定义目录，不写入默认目录。
- 连续执行两次同一采集命令，不生成重复项目文件，不追加重复 commit。
- commit 内容无变化时，`manifest.json` 中 `contentHash` 保持一致。

## 阶段 6：第一版端到端验收与文档

### 目标

确认第一版 CLI 能力可用，并更新项目文档。

### 主要任务

- 更新根目录 `README.md`，替换 Turborepo starter 内容。
- 增加安装、初始化、扫描、列表、采集、自定义 `outputRoot` 示例。
- 增加第一版不支持功能说明。
- 使用临时 Git 测试仓库做端到端验证。
- 整理已知限制和后续 MCP 计划。

### 交付物

- 更新后的 `README.md`
- 可选：`examples/weekly.config.json`
- 可选：开发验证记录

### 验收

- `pnpm lint` 通过。
- `pnpm check-types` 通过。
- `pnpm build` 通过。
- 端到端执行 `weekly init`、`weekly scan`、`weekly list`、`weekly collect` 成功。

## 阶段 7：MCP Server

### 目标

实现 Agent 可调用的 MCP Server，使 Agent 能读取项目索引并触发采集、读取原始记录。

### 主要任务

- 实现 MCP Server 启动入口。
- 实现 `list_projects`。
- 实现 `scan_projects`。
- 实现 `collect_git_logs`。
- 实现 `get_week_index`。
- 实现 `read_week_raw`。
- 所有 MCP tool 入参使用 Zod 校验。
- 读取原始记录时，只允许访问 `config.json` 中 `outputRoot` 下的文件。

### 交付物

- `packages/mcp-server/src/index.ts`
- `packages/mcp-server/src/tools/list-projects.ts`
- `packages/mcp-server/src/tools/scan-projects.ts`
- `packages/mcp-server/src/tools/collect-git-logs.ts`
- `packages/mcp-server/src/tools/get-week-index.ts`
- `packages/mcp-server/src/tools/read-week-raw.ts`

### 验收

- Agent 能调用 `list_projects` 查看项目列表。
- Agent 能调用 `collect_git_logs` 采集指定周期。
- Agent 能调用 `get_week_index` 读取周期索引。
- Agent 能调用 `read_week_raw` 读取该周期所有项目原始记录。
- MCP 读取路径不能逃逸出 `outputRoot`。

## 阶段 8：稳定性增强

### 目标

补齐需求文档中的稳定性和边界场景。

### 主要任务

- 完善重名项目文件名处理：使用 remote 命名空间生成 `namespace__project.md`。
- 完善 Git worktree 和 submodule 场景。
- 完善 `.history` 备份策略。
- 增加更细的错误分类和 warning 输出。
- 增加测试覆盖，包括路径处理、schema、扫描、采集、写入、幂等。

### 交付物

- 重名项目处理逻辑
- 备份策略完善
- 测试用例

### 验收

- 重名项目不会互相覆盖。
- worktree 或 submodule 中 `.git` 文件可以被识别。
- 开启 `--backup` 后旧文件进入 `.history`。
- 核心逻辑测试通过。

## 第一版完成定义

第一版完成时必须满足：

- 支持 `weekly init`。
- 支持 `weekly scan`。
- 支持 `weekly list`。
- 支持 `weekly collect`。
- 生成 `config.json`。
- 生成 `projects.json`。
- 生成项目 Markdown。
- 生成 `index.md`。
- 生成 `manifest.json`。
- 默认覆盖模式幂等。
- 使用 Zod 校验外部输入。
- 支持通过 `config.json` 的 `outputRoot` 自定义输出目录。

第一版明确不做：

- 自定义工具工作目录。
- `weekly collect --output`。
- GitHub / GitLab PR API。
- Jira / TAPD / 禅道 API。
- 自动生成最终公司周报。

## 推荐执行顺序

1. 阶段 0：项目骨架调整。
2. 阶段 1：Shared Schemas 与基础工具。
3. 阶段 2：配置初始化与读取。
4. 阶段 3：Git 项目扫描与列表。
5. 阶段 4：Git Commit 采集。
6. 阶段 5：Markdown、Index 与 Manifest 输出。
7. 阶段 6：第一版端到端验收与文档。
8. 阶段 7：MCP Server。
9. 阶段 8：稳定性增强。
