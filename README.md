# weekly-git-report

`weekly-git-report` 是一个本地 Node.js + TypeScript CLI 工具，用于扫描多个 Git 项目，采集指定周期内的 commit 记录，并生成结构化 Markdown 原始记录。

本项目只生成“原始 Git 提交记录”，不负责自动生成最终公司周报。

## 已实现能力

- `weekly init`：初始化本地配置。
- `weekly scan`：扫描 Git 项目并生成项目索引。
- `weekly list`：查看已扫描项目列表。
- `weekly collect`：采集 commit 并生成 Markdown、`index.md`、`manifest.json`。
- 支持通过 `config.json` 的 `outputRoot` 自定义原始记录输出目录。
- 支持重复采集同一项目、同一周期时幂等处理。
- 使用 Zod 校验配置、项目索引、采集参数和 manifest。

## 目录说明

工具工作目录固定为：

```text
~/.weekly-git-report/
```

初始化后包含：

```text
~/.weekly-git-report/
  config.json
  projects.json
```

默认周报原始记录输出目录为：

```text
~/weekly-reports/
```

采集后生成：

```text
~/weekly-reports/raw/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}/
  index.md
  manifest.json
  {project}.md
```

## 开发命令

```sh
pnpm install
pnpm check-types
pnpm build
pnpm lint
```

## CLI 使用

当前包的 CLI 入口为 `packages/cli`，构建后可以直接通过 Node 运行：

```sh
pnpm build
node packages/cli/dist/index.js --help
```

后续发布或本地 link 后，命令名为：

```sh
weekly
```

### 初始化

```sh
weekly init
```

作用：

- 创建 `~/.weekly-git-report/`。
- 创建默认 `config.json`。
- 创建默认输出目录 `~/weekly-reports/raw` 和 `~/weekly-reports/summary`。
- 如果配置文件已存在，不会覆盖。

默认配置：

```json
{
  "roots": ["~/work", "~/Code", "~/Projects"],
  "excludeDirs": ["node_modules", ".cache", "dist", "build", "vendor", "tmp"],
  "maxDepth": 5,
  "outputRoot": "~/weekly-reports",
  "author": "",
  "defaultSince": "last monday",
  "defaultUntil": "now",
  "includeEmptyProjects": false
}
```

### 扫描项目

```sh
weekly scan
weekly scan --root ~/work --root ~/Code
weekly scan --max-depth 6
```

扫描会递归查找包含 `.git` 目录或 `.git` 文件的 Git 项目，并生成：

```text
~/.weekly-git-report/projects.json
```

扫描时会读取每个项目的 remote、branch 和最近提交时间。同一个 remote 对应多个本地路径时，保留最近活跃的项目。

### 查看项目列表

```sh
weekly list
```

输出项目名、分支和 remote。

### 采集 Git 提交记录

```sh
weekly collect
weekly collect --since 2026-06-01 --until 2026-06-07
weekly collect --author "张三"
weekly collect --project order-service
weekly collect --all
weekly collect --backup
```

author 优先级：

```text
CLI 参数 author > config.json author > git config user.name
```

采集完成后输出示例：

```text
Generated:
~/weekly-reports/raw/2026/06/2026-06-01_2026-06-07

Projects: 3
Commits: 16
Updated files: 3
Skipped files: 0
Errors: 0
```

## 自定义输出目录

编辑：

```text
~/.weekly-git-report/config.json
```

修改：

```json
{
  "outputRoot": "~/Documents/company-weekly-reports"
}
```

之后执行：

```sh
weekly collect --since 2026-06-01 --until 2026-06-07
```

结果会写入：

```text
~/Documents/company-weekly-reports/raw/2026/06/2026-06-01_2026-06-07/
```

不会写入默认目录，除非 `outputRoot` 本身就是默认路径。

## 幂等策略

- 同一项目和同一周期始终写入同一个 Markdown 文件。
- 默认覆盖模式，禁止追加写入。
- 不生成 `-1`、`-copy`、`-new` 这类重复文件。
- 每个项目 Markdown 会计算 `contentHash`。
- `generatedAt` 和“采集时间”不参与 `contentHash`。
- 如果内容未变化，重复采集会跳过项目 Markdown 写入。

## 第一版暂不支持

- 自定义工具工作目录。
- `weekly collect --output`。
- GitHub / GitLab PR API。
- Jira / TAPD / 禅道 API。
- 自动生成最终公司周报。

## Monorepo 包

- `packages/shared`：常量、Zod schemas、类型。
- `packages/core`：配置、路径、Git、扫描、采集、写入逻辑。
- `packages/cli`：CLI 命令入口。
- `packages/mcp-server`：MCP stdio server 和 Agent 工具。
- `packages/eslint-config`：共享 ESLint 配置。
- `packages/typescript-config`：共享 TypeScript 配置。
