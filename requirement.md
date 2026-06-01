# weekly-git-report 需求文档

## 1. 项目背景

当前公司周报需要人工回忆多个项目在一周内的工作内容，效率较低且容易遗漏。开发人员通常会在多个 Git 项目中提交代码，但这些提交记录分散在不同目录、不同仓库中，不方便统一采集和总结。

本项目目标是开发一个基于 **Node.js + TypeScript + MCP + Zod** 的 monorepo 工具，用于自动扫描本机多个 Git 项目，采集指定时间范围内的 Git commit 记录，并在本地生成结构化 Markdown 文件。后续可由 AI Agent 读取这些 Markdown 文件，生成公司周报总结。

本项目只负责生成“原始 Git 提交记录”，不直接负责生成最终公司周报。

---

## 2. 项目目标

### 2.1 核心目标

1. 自动扫描本机指定根目录下的 Git 项目。
2. 生成项目索引文件，记录项目名称、路径、remote、branch、最近活跃时间等信息。
3. 支持按时间范围批量采集多个项目的 Git commit 记录。
4. 按固定目录结构生成 Markdown 文件。
5. 支持用户自定义周报原始记录输出目录。
6. 支持重复采集同一项目、同一时间范围时幂等处理。
7. 提供 MCP Server，使 Agent 可以读取项目索引和 Git 原始记录。
8. 使用 Zod 对 CLI 入参、配置文件、项目索引、MCP tool 参数进行校验。

### 2.2 非目标

1. 不负责自动生成最终公司周报。
2. 不负责直接连接 GitHub、GitLab、Jira、飞书等远程 API。
3. 不负责分析 commit 的业务含义。
4. 不负责上传文件到云端。
5. 不负责管理用户 Git 凭证。
6. 第一版不支持自定义工具工作目录。

---

## 3. 技术栈

### 3.1 核心技术

- Node.js
- TypeScript
- MCP
- Zod
- pnpm workspace
- Git CLI

### 3.2 推荐依赖

- `zod`：数据校验
- `commander` 或 `cac`：CLI 命令解析
- `execa`：执行 Git 命令
- `fast-glob`：扫描目录
- `fs-extra`：文件读写
- `dayjs`：日期处理
- `@modelcontextprotocol/sdk`：MCP Server 开发

---

## 4. Monorepo 目录结构

推荐目录结构如下：

```text
weekly-git-report/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  README.md

  packages/
    core/
      src/
        config/
        git/
        scanner/
        collector/
        writer/
        manifest/
        schemas/
        utils/
        index.ts
      package.json

    cli/
      src/
        commands/
          init.ts
          scan.ts
          list.ts
          collect.ts
        index.ts
      package.json

    mcp-server/
      src/
        tools/
          list-projects.ts
          scan-projects.ts
          collect-git-logs.ts
          get-week-index.ts
          read-week-raw.ts
        index.ts
      package.json

    shared/
      src/
        constants.ts
        schemas.ts
        types.ts
      package.json

  examples/
    weekly.config.json
```

---

## 5. 数据目录设计

本项目涉及两个目录：

1. 工具工作目录
2. 周报原始记录输出目录

### 5.1 工具工作目录

工具工作目录固定为：

```text
~/.weekly-git-report/
```

初始化后目录结构如下：

```text
~/.weekly-git-report/
  config.json
  projects.json
```

其中：

```text
~/.weekly-git-report/config.json
```

用于保存扫描配置。

```text
~/.weekly-git-report/projects.json
```

用于保存扫描得到的 Git 项目索引。

第一版不要求支持自定义工具工作目录。

### 5.2 周报原始记录输出目录

周报原始记录默认输出到：

```text
~/weekly-reports/
```

默认生成结构如下：

```text
~/weekly-reports/
  raw/
  summary/
```

其中：

```text
raw/
```

由本项目生成，用于保存 Git 原始提交记录。

```text
summary/
```

预留给后续 Agent 生成公司周报总结使用，本项目第一版不负责写入。

### 5.3 输出目录自定义

周报原始记录输出目录支持通过配置文件自定义。

配置项为：

```json
{
  "outputRoot": "~/weekly-reports"
}
```

如果用户配置：

```json
{
  "outputRoot": "~/Documents/company-weekly-reports"
}
```

则采集结果应生成到：

```text
~/Documents/company-weekly-reports/
  raw/
    2026/
      06/
        2026-06-01_2026-06-07/
          index.md
          manifest.json
          order-service.md
```

第一版不要求支持 `weekly collect --output` 参数。

---

## 6. 原始记录目录结构

采集指定周期的 Git 提交记录后，生成如下目录：

```text
{outputRoot}/
  raw/
    2026/
      06/
        2026-06-01_2026-06-07/
          index.md
          manifest.json
          order-service.md
          admin-web.md
          payment-api.md
```

其中 `{outputRoot}` 来自配置文件：

```json
{
  "outputRoot": "~/weekly-reports"
}
```

### 6.1 目录规则

周期目录格式：

```text
{outputRoot}/raw/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}/
```

示例：

```text
~/weekly-reports/raw/2026/06/2026-06-01_2026-06-07/
```

### 6.2 文件规则

每个项目生成一个 Markdown 文件：

```text
{projectFileName}.md
```

示例：

```text
order-service.md
admin-web.md
backend__order-service.md
```

项目文件名优先使用项目名。

如果存在重名项目，例如：

```text
backend/order-service
frontend/order-service
```

则使用 remote 推导出的命名空间加项目名：

```text
backend__order-service.md
frontend__order-service.md
```

---

## 7. 配置文件设计

配置文件路径固定为：

```text
~/.weekly-git-report/config.json
```

示例：

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

字段说明：

| 字段                 | 类型     | 必填 | 说明                                                            |
| -------------------- | -------- | ---- | --------------------------------------------------------------- |
| roots                | string[] | 是   | 要扫描的代码根目录                                              |
| excludeDirs          | string[] | 否   | 扫描时排除的目录                                                |
| maxDepth             | number   | 否   | 最大扫描深度，默认 5                                            |
| outputRoot           | string   | 是   | Git 原始记录输出根目录，默认 `~/weekly-reports`，支持用户自定义 |
| author               | string   | 否   | Git author 过滤条件，不填则使用当前 Git 用户                    |
| defaultSince         | string   | 否   | 默认开始时间                                                    |
| defaultUntil         | string   | 否   | 默认结束时间                                                    |
| includeEmptyProjects | boolean  | 否   | 是否为无提交项目生成 Markdown 文件，默认 false                  |

### 7.1 outputRoot 说明

`outputRoot` 只影响 Git 原始记录的输出位置，不影响工具自身配置目录。

默认值：

```text
~/weekly-reports
```

如果配置为：

```json
{
  "outputRoot": "~/Documents/company-weekly-reports"
}
```

则最终生成目录为：

```text
~/Documents/company-weekly-reports/raw/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}/
```

---

## 8. 项目索引 projects.json

扫描后生成：

```text
~/.weekly-git-report/projects.json
```

示例：

```json
{
  "version": 1,
  "generatedAt": "2026-06-07T18:30:00.000Z",
  "projects": [
    {
      "id": "gitlab.company.com/backend/order-service",
      "name": "order-service",
      "fileName": "order-service.md",
      "path": "/Users/user/work/backend/order-service",
      "remote": "git@gitlab.company.com:backend/order-service.git",
      "branch": "main",
      "lastCommitAt": "2026-06-06T10:20:00.000Z",
      "isDuplicate": false
    }
  ]
}
```

字段说明：

| 字段         | 类型    | 说明                             |
| ------------ | ------- | -------------------------------- |
| id           | string  | 项目唯一标识，优先由 remote 推导 |
| name         | string  | 项目名称                         |
| fileName     | string  | 输出 Markdown 文件名             |
| path         | string  | 本地项目路径                     |
| remote       | string  | Git origin remote                |
| branch       | string  | 当前分支                         |
| lastCommitAt | string  | 最近一次 commit 时间             |
| isDuplicate  | boolean | 是否为重复 remote 项目           |

---

## 9. 扫描 Git 项目

### 9.1 扫描逻辑

`weekly scan` 需要遍历配置文件中的 `roots`，递归查找 Git 项目。

识别为 Git 项目的条件：

```text
目录下存在 .git 文件或 .git 目录
```

需要支持以下两种情况：

```text
project/.git/
project/.git
```

其中：

```text
project/.git/
```

是普通 Git 仓库常见形式。

```text
project/.git
```

可能出现在 Git worktree 或 submodule 场景。

扫描时需要忽略配置中的 `excludeDirs`，例如：

```text
node_modules
.cache
dist
build
vendor
tmp
```

### 9.2 扫描时需要获取的信息

对每个 Git 项目执行：

```bash
git remote get-url origin
git branch --show-current
git log -1 --format=%cI
```

### 9.3 去重规则

同一个 remote 对应多个本地路径时，默认只保留最近活跃的一个。

去重优先级：

```text
remote URL > 本地路径 > 项目名称
```

如果 remote 相同，则选择 `lastCommitAt` 最新的项目。

如果项目没有 remote，则使用本地路径作为唯一标识。

---

## 10. Git 提交采集

### 10.1 采集命令

对每个项目执行：

```bash
git log \
  --since="{since}" \
  --until="{until}" \
  --author="{author}" \
  --pretty=format:"%cI%x1f%h%x1f%an%x1f%s"
```

字段说明：

| 字段 | 说明                                             |
| ---- | ------------------------------------------------ |
| %cI  | ISO 格式提交时间                                 |
| %h   | 短 commit hash                                   |
| %an  | 作者名                                           |
| %s   | commit subject                                   |
| %x1f | 字段分隔符，避免与 commit message 中常见字符冲突 |

### 10.2 采集范围

默认采集当前用户本周提交。

默认时间范围：

```text
since: 本周一 00:00:00
until: 当前时间
```

也需要支持手动指定：

```bash
weekly collect --since 2026-06-01 --until 2026-06-07
```

### 10.3 author 规则

author 优先级：

```text
CLI 参数 author > config.json author > git config user.name
```

如果三个来源都为空，则不添加 `--author` 参数，采集该项目指定时间范围内的所有提交。

---

## 11. Markdown 文件格式

### 11.1 单项目 Markdown 文件

示例：

````md
# order-service

- 周期：2026-06-01 ~ 2026-06-07
- 项目路径：/Users/user/work/backend/order-service
- Git Remote：git@gitlab.company.com:backend/order-service.git
- 当前分支：main
- 采集时间：2026-06-07 18:30:00
- Commit 数：3
- 生成策略：overwrite

## Commits

| 日期       | Hash    | 作者 | Commit                     |
| ---------- | ------- | ---- | -------------------------- |
| 2026-06-02 | a1b2c3d | user | fix: 修复订单状态同步异常  |
| 2026-06-04 | b2c3d4e | user | feat: 增加订单导出任务     |
| 2026-06-06 | c3d4e5f | user | refactor: 优化订单查询逻辑 |

## Raw

```text
2026-06-02T10:20:00+08:00 a1b2c3d user fix: 修复订单状态同步异常
2026-06-04T15:40:00+08:00 b2c3d4e user feat: 增加订单导出任务
2026-06-06T18:10:00+08:00 c3d4e5f user refactor: 优化订单查询逻辑
```
````

### 11.2 无提交时的 Markdown 文件

如果项目在该周期内没有提交，默认不生成项目 Markdown 文件。

如果配置：

```json
{
  "includeEmptyProjects": true
}
```

则无提交项目也生成 Markdown 文件。

示例：

````md
# order-service

- 周期：2026-06-01 ~ 2026-06-07
- 项目路径：/Users/user/work/backend/order-service
- Git Remote：git@gitlab.company.com:backend/order-service.git
- 当前分支：main
- 采集时间：2026-06-07 18:30:00
- Commit 数：0
- 生成策略：overwrite

## Commits

本周期无提交记录。

## Raw

```text

```
````

---

## 12. index.md 文件格式

每个周期目录生成一个 `index.md`，作为该周期原始记录的入口文件。

示例：

```md
# Git 原始记录索引

- 周期：2026-06-01 ~ 2026-06-07
- 采集时间：2026-06-07 18:30:00
- 输出目录：/Users/user/weekly-reports/raw/2026/06/2026-06-01_2026-06-07
- 项目数量：3
- 总 Commit 数：16

## 项目列表

| 项目          | 文件               | Remote                                           | Branch  | Commit 数 |
| ------------- | ------------------ | ------------------------------------------------ | ------- | --------- |
| order-service | ./order-service.md | git@gitlab.company.com:backend/order-service.git | main    | 8         |
| admin-web     | ./admin-web.md     | git@gitlab.company.com:frontend/admin-web.git    | develop | 5         |
| payment-api   | ./payment-api.md   | git@gitlab.company.com:backend/payment-api.git   | main    | 3         |

## Agent 读取建议

请先读取本文件，了解本周期包含的项目列表。
然后根据“项目列表”中的文件路径逐个读取项目 Markdown 文件。
总结时只基于这些 Git 提交记录，不要编造未出现的信息。
```

---

## 13. manifest.json 文件格式

每个周期目录同时生成 `manifest.json`，用于程序稳定解析和幂等判断。

示例：

```json
{
  "version": 1,
  "period": {
    "start": "2026-06-01",
    "end": "2026-06-07"
  },
  "generatedAt": "2026-06-07T18:30:00.000Z",
  "outputRoot": "/Users/user/weekly-reports",
  "outputDir": "/Users/user/weekly-reports/raw/2026/06/2026-06-01_2026-06-07",
  "projects": [
    {
      "id": "gitlab.company.com/backend/order-service",
      "name": "order-service",
      "file": "./order-service.md",
      "path": "/Users/user/work/backend/order-service",
      "remote": "git@gitlab.company.com:backend/order-service.git",
      "branch": "main",
      "commitCount": 8,
      "contentHash": "sha256:abc123"
    }
  ],
  "errors": []
}
```

如果某个项目采集失败，需要记录到 `errors` 中：

```json
{
  "errors": [
    {
      "projectId": "gitlab.company.com/backend/order-service",
      "name": "order-service",
      "path": "/Users/user/work/backend/order-service",
      "message": "fatal: not a git repository"
    }
  ]
}
```

---

## 14. 幂等策略

### 14.1 唯一键

同一个采集结果由以下字段唯一确定：

```text
period.start + period.end + project.remote
```

如果项目没有 remote，则使用：

```text
period.start + period.end + project.path
```

### 14.2 默认行为

默认使用覆盖模式：

```text
同一项目 + 同一周期 = 同一个 Markdown 文件
重复采集时重新生成并覆盖旧文件
```

禁止追加写入。

不允许生成以下重复文件：

```text
order-service-1.md
order-service-copy.md
order-service-new.md
```

### 14.3 contentHash

每次生成项目 Markdown 内容后，计算 SHA-256：

```text
contentHash = sha256(markdownContentWithoutGeneratedAt)
```

注意：`generatedAt` 或“采集时间”不应参与 hash 计算，否则每次采集 hash 都会变化。

### 14.4 写入规则

1. 如果文件不存在，直接写入。
2. 如果文件存在且 contentHash 相同，可以跳过写入。
3. 如果文件存在且 contentHash 不同，覆盖写入。
4. 如果用户开启 `--backup`，覆盖前将旧文件复制到 `.history` 目录。

### 14.5 备份目录

可选备份目录：

```text
{outputRoot}/raw/2026/06/2026-06-01_2026-06-07/.history/
  order-service.2026-06-07_18-30-00.md
```

默认不启用备份。

---

## 15. CLI 需求

CLI 命令名暂定为：

```bash
weekly
```

### 15.1 初始化配置

```bash
weekly init
```

作用：

1. 创建 `~/.weekly-git-report/` 目录。
2. 创建默认 `config.json`。
3. 创建默认输出目录 `~/weekly-reports/`。
4. 如果配置文件已存在，不应直接覆盖，需提示用户。

默认生成配置：

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

### 15.2 扫描项目

```bash
weekly scan
```

作用：

1. 根据配置扫描 Git 项目。
2. 生成 `~/.weekly-git-report/projects.json`。
3. 输出扫描结果摘要。

可选参数：

```bash
weekly scan --root ~/work --root ~/Code
weekly scan --max-depth 6
```

参数优先级：

```text
CLI 参数 > config.json
```

### 15.3 查看项目列表

```bash
weekly list
```

输出示例：

```text
order-service   main      git@gitlab.company.com:backend/order-service.git
admin-web       develop   git@gitlab.company.com:frontend/admin-web.git
```

### 15.4 采集 Git 提交记录

```bash
weekly collect
```

默认采集本周。

支持参数：

```bash
weekly collect --since 2026-06-01 --until 2026-06-07
weekly collect --author "张三"
weekly collect --project order-service
weekly collect --all
weekly collect --backup
```

第一版不支持：

```bash
weekly collect --output
```

输出目录只通过 `config.json` 中的 `outputRoot` 控制。

### 15.5 输出目录规则

`weekly collect` 生成文件时，应读取配置文件中的 `outputRoot` 作为输出根目录。

默认输出：

```text
~/weekly-reports/raw/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}/
```

如果 `config.json` 中配置：

```json
{
  "outputRoot": "~/Documents/company-weekly-reports"
}
```

则输出到：

```text
~/Documents/company-weekly-reports/raw/{YYYY}/{MM}/{YYYY-MM-DD}_{YYYY-MM-DD}/
```

### 15.6 采集完成输出

采集完成后输出：

```text
Generated:
~/weekly-reports/raw/2026/06/2026-06-01_2026-06-07/

Projects: 3
Commits: 16
Updated files: 3
Skipped files: 0
Errors: 0
```

---

## 16. MCP Server 需求

MCP Server 需要读取本地配置、项目索引、原始记录目录，并向 Agent 暴露工具。

MCP Server 读取配置文件：

```text
~/.weekly-git-report/config.json
```

MCP Server 读取项目索引：

```text
~/.weekly-git-report/projects.json
```

MCP Server 读取 Git 原始记录时，必须基于 `config.json` 中的 `outputRoot` 计算路径。

### 16.1 MCP Tool: list_projects

用途：列出已扫描的 Git 项目。

参数：

```json
{}
```

返回：

```json
{
  "projects": [
    {
      "id": "gitlab.company.com/backend/order-service",
      "name": "order-service",
      "path": "/Users/user/work/backend/order-service",
      "remote": "git@gitlab.company.com:backend/order-service.git",
      "branch": "main"
    }
  ]
}
```

### 16.2 MCP Tool: scan_projects

用途：触发项目扫描。

参数：

```json
{
  "roots": ["~/work", "~/Code"],
  "maxDepth": 5
}
```

返回：

```json
{
  "projectCount": 10,
  "projectsFile": "~/.weekly-git-report/projects.json"
}
```

### 16.3 MCP Tool: collect_git_logs

用途：采集指定时间范围内的 Git 提交记录。

参数：

```json
{
  "since": "2026-06-01",
  "until": "2026-06-07",
  "author": "张三",
  "projectIds": []
}
```

说明：

- `projectIds` 为空时采集全部项目。
- `projectIds` 不为空时只采集指定项目。
- 输出目录由 `config.json` 中的 `outputRoot` 决定。

返回：

```json
{
  "outputDir": "~/weekly-reports/raw/2026/06/2026-06-01_2026-06-07",
  "indexFile": "~/weekly-reports/raw/2026/06/2026-06-01_2026-06-07/index.md",
  "manifestFile": "~/weekly-reports/raw/2026/06/2026-06-01_2026-06-07/manifest.json",
  "projectCount": 3,
  "commitCount": 16,
  "errors": []
}
```

### 16.4 MCP Tool: get_week_index

用途：读取指定周期的 `index.md`。

参数：

```json
{
  "start": "2026-06-01",
  "end": "2026-06-07"
}
```

返回：

```json
{
  "content": "# Git 原始记录索引\n..."
}
```

### 16.5 MCP Tool: read_week_raw

用途：读取指定周期的所有项目原始 Git 记录。

参数：

```json
{
  "start": "2026-06-01",
  "end": "2026-06-07"
}
```

返回：

```json
{
  "files": [
    {
      "name": "order-service.md",
      "content": "# order-service\n..."
    }
  ]
}
```

---

## 17. Zod Schema 要求

所有外部输入都必须经过 Zod 校验。

需要定义以下 schema：

1. ConfigSchema
2. ProjectSchema
3. ProjectsIndexSchema
4. CollectOptionsSchema
5. PeriodSchema
6. ManifestSchema
7. McpToolInputSchema

示例：

```ts
import { z } from "zod";

export const PeriodSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const ConfigSchema = z.object({
  roots: z.array(z.string()).min(1),
  excludeDirs: z.array(z.string()).default([]),
  maxDepth: z.number().int().positive().default(5),
  outputRoot: z.string().default("~/weekly-reports"),
  author: z.string().optional().default(""),
  defaultSince: z.string().optional().default("last monday"),
  defaultUntil: z.string().optional().default("now"),
  includeEmptyProjects: z.boolean().default(false),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  fileName: z.string(),
  path: z.string(),
  remote: z.string().optional(),
  branch: z.string().optional(),
  lastCommitAt: z.string().optional(),
  isDuplicate: z.boolean().default(false),
});

export const CollectOptionsSchema = z.object({
  since: z.string(),
  until: z.string(),
  author: z.string().optional(),
  projectIds: z.array(z.string()).default([]),
  backup: z.boolean().default(false),
});
```

---

## 18. 错误处理

### 18.1 Git 项目不可访问

如果某个项目路径不存在或无法执行 Git 命令：

1. 不应中断全部任务。
2. 当前项目跳过。
3. 在 `manifest.json` 的 `errors` 中记录失败项目。
4. CLI 输出 warning。
5. 继续处理其他项目。

### 18.2 Git 命令失败

失败示例：

```text
fatal: not a git repository
fatal: bad revision
```

处理方式：

1. 当前项目跳过。
2. 记录错误。
3. 继续处理其他项目。

### 18.3 配置文件不存在

执行非 `init` 命令时，如果配置文件不存在，应提示用户先执行：

```bash
weekly init
```

错误提示：

```text
Config not found. Please run: weekly init
```

### 18.4 outputRoot 不存在

如果 `outputRoot` 目录不存在，`weekly collect` 应自动创建。

如果没有权限创建，应中断采集并提示：

```text
Failed to create outputRoot: {path}
```

---

## 19. Markdown 转义规则

commit message 可能包含 Markdown 表格特殊字符，需要处理。

至少需要转义：

```text
|
`
```

表格中的 `|` 应替换为：

```text
\|
```

换行符需要替换为空格。

---

## 20. 路径处理规则

需要支持 `~` 路径展开。

例如：

```text
~/weekly-reports
```

在 macOS 上应解析为：

```text
/Users/{username}/weekly-reports
```

在 Linux 上应解析为：

```text
/home/{username}/weekly-reports
```

Windows 可按 Node.js 的 home directory 规则解析。

所有写入文件前，应将路径规范化为绝对路径。

---

## 21. 安全与隐私

1. 本工具默认只在本地运行。
2. 不上传 Git 提交内容。
3. 不读取项目源码内容，只读取 Git 元数据。
4. MCP tool 返回内容前应限制读取范围，只允许读取配置输出目录下的文件。
5. 不允许 MCP tool 读取任意系统路径。
6. 不保存 Git 凭证。
7. 不执行来自用户输入的任意 shell 命令。
8. 所有路径必须经过规范化处理，避免路径穿越问题。

---

## 22. 开发里程碑

### Milestone 1：CLI 基础能力

- 初始化配置
- 扫描 Git 项目
- 生成 projects.json
- 查看项目列表
- 支持 outputRoot 配置

### Milestone 2：Git 采集与 Markdown 输出

- 按时间范围采集 commits
- 生成项目 Markdown
- 生成 index.md
- 生成 manifest.json
- 支持幂等覆盖
- 支持自定义 outputRoot 输出

### Milestone 3：MCP Server

- 提供 list_projects
- 提供 scan_projects
- 提供 collect_git_logs
- 提供 get_week_index
- 提供 read_week_raw
- MCP 读取 outputRoot 下的原始记录

### Milestone 4：稳定性增强

- backup 模式
- contentHash 跳过写入
- 重名项目处理
- Git worktree 支持
- 错误项目记录

---

## 23. 验收标准

### 23.1 初始化验收

执行：

```bash
weekly init
```

应生成：

```text
~/.weekly-git-report/
  config.json
```

默认配置中应包含：

```json
{
  "outputRoot": "~/weekly-reports"
}
```

### 23.2 扫描验收

给定配置：

```json
{
  "roots": ["~/work"],
  "maxDepth": 5,
  "outputRoot": "~/weekly-reports"
}
```

执行：

```bash
weekly scan
```

应生成：

```text
~/.weekly-git-report/projects.json
```

并包含所有扫描到的 Git 项目。

### 23.3 默认采集验收

执行：

```bash
weekly collect --since 2026-06-01 --until 2026-06-07
```

应生成：

```text
~/weekly-reports/raw/2026/06/2026-06-01_2026-06-07/
  index.md
  manifest.json
  *.md
```

### 23.4 自定义 outputRoot 验收

如果配置文件中设置：

```json
{
  "outputRoot": "~/Documents/company-weekly-reports"
}
```

执行：

```bash
weekly collect --since 2026-06-01 --until 2026-06-07
```

应生成：

```text
~/Documents/company-weekly-reports/raw/2026/06/2026-06-01_2026-06-07/
  index.md
  manifest.json
  *.md
```

不应再写入默认目录：

```text
~/weekly-reports/raw/2026/06/2026-06-01_2026-06-07/
```

除非用户配置的 `outputRoot` 本身就是默认路径。

### 23.5 幂等验收

连续执行两次：

```bash
weekly collect --since 2026-06-01 --until 2026-06-07
```

应满足：

1. 不生成重复项目文件。
2. 不追加重复 commit。
3. 同一项目仍然对应同一个 Markdown 文件。
4. `manifest.json` 中项目数量不重复。
5. 若 commit 内容无变化，contentHash 保持一致。

### 23.6 MCP 验收

Agent 调用：

```text
list_projects
collect_git_logs
get_week_index
read_week_raw
```

应能完成：

1. 查看项目列表。
2. 采集指定周期 Git 记录。
3. 读取周期索引。
4. 读取该周期所有项目原始记录。
5. 正确使用 `config.json` 中的 `outputRoot`。

---

## 24. 推荐使用流程

用户首次使用：

```bash
weekly init
weekly scan
weekly list
```

每周使用：

```bash
weekly collect
```

指定周期使用：

```bash
weekly collect --since 2026-06-01 --until 2026-06-07
```

自定义输出目录：

1. 编辑配置文件：

```text
~/.weekly-git-report/config.json
```

2. 修改：

```json
{
  "outputRoot": "~/Documents/company-weekly-reports"
}
```

3. 执行：

```bash
weekly collect
```

Agent 使用：

```text
1. 调用 get_week_index 查看该周期有哪些项目。
2. 调用 read_week_raw 读取所有项目原始记录。
3. 基于原始记录生成公司周报总结。
```

---

## 25. 后续扩展方向

1. 支持 GitHub / GitLab PR 记录采集。
2. 支持 Jira / TAPD / 禅道任务记录采集。
3. 支持每日记录合并。
4. 支持周报 summary 自动生成。
5. 支持多作者协作统计。
6. 支持 Web UI 查看周报原始记录。
7. 支持 VS Code 插件。
8. 支持定时任务自动采集。
9. 支持 CLI 参数临时覆盖输出目录，例如 `weekly collect --output`。

---

## 26. 第一版建议实现范围

第一版建议只实现以下能力：

1. `weekly init`
2. `weekly scan`
3. `weekly list`
4. `weekly collect`
5. 生成 `config.json`
6. 生成 `projects.json`
7. 生成项目 Markdown
8. 生成 `index.md`
9. 生成 `manifest.json`
10. 默认覆盖模式
11. Zod 参数校验
12. 支持通过 `config.json` 的 `outputRoot` 自定义输出目录

MCP Server 可以作为第二阶段实现，但 monorepo 结构可以第一版就预留出来。

第一版不要求支持：

1. 自定义工具工作目录
2. `weekly collect --output`
3. GitHub / GitLab PR API
4. Jira / TAPD / 禅道 API
5. 自动生成最终公司周报
