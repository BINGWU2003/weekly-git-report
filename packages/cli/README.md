# @weekly-git-report/cli

交互式配置和项目管理 CLI。

## 使用

```sh
npx -y @weekly-git-report/cli@latest
```

无参数时显示菜单。也可以使用明确命令：

```text
weekly init
weekly config edit
weekly projects add
weekly projects edit
weekly projects remove
weekly projects list
weekly projects sync [id-or-name]
weekly doctor
```

配置写入 `~/.weekly-git-report/config.json` 和 `projects.json`。初始化、添加、编辑和删除要求交互式终端；`list`、`sync` 和 `doctor` 可独立运行。

添加项目会先验证远程 URL 和分支，再确定 `localPath`。目标不存在时创建裸仓库缓存；已有 Git 仓库必须拥有匹配的 `origin`；非空普通目录不会被覆盖。

删除项目只移除 JSON 配置，不删除本地仓库。

完整配置结构和流程见仓库根目录 README。
