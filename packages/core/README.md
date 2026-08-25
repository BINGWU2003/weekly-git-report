# @weekly-git-report/core

内部核心包，负责：

- 全局配置和项目 JSON 的校验、读取与原子写入
- 仓库 URL 规范化、默认缓存路径和防重文件名
- 裸仓库创建、已有仓库 remote 校验与指定分支 fetch
- 按周期和作者身份采集 Git 提交
- raw Markdown、manifest、索引和 summary 路径生成

该包不直接提供用户命令，由 CLI、workflow、Agent CLI 和 MCP 组合使用。
