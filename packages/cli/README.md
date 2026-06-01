# @weekly-git-report/cli

用于扫描本地 Git 仓库并生成周报原始提交记录的 CLI 工具。

## 安装

```sh
npm install -g @weekly-git-report/cli
```

## 使用

```sh
weekly init
weekly scan --root E:/workspace/project
weekly list
weekly collect --since 2026-06-01 --until 2026-06-07
```

`weekly init` 会交互式询问项目扫描根目录 `roots` 和周报输出目录 `outputRoot`。多个 `roots` 目录用 `，` 隔开，直接回车会使用默认值。

CLI 会将配置保存到 `~/.weekly-git-report/config.json`，并将周报原始记录写入配置中的 `outputRoot`。
