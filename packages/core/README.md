# @weekly-git-report/core

内部核心包，负责：

- 全局配置和项目 JSON 的校验、读取与原子写入
- 仓库 URL 规范化、默认缓存路径和防重文件名
- 裸仓库创建、已有仓库 remote 校验与指定分支 fetch
- 本地文件夹仓库扫描、批量同步添加和 revision 冲突保护
- 从配置分支远程引用读取最新提交运行状态
- 按周期和作者身份采集 Git 提交
- raw Markdown、manifest、索引和 summary 路径生成
- 规范报告目录索引、Raw manifest 元数据关联和严格完整性检查
- 周报提示词模板的初始化、变量渲染、校验、原子写入和 revision 冲突保护

该包不直接提供用户命令，由 CLI、Electron、workflow 和 MCP 组合使用。
