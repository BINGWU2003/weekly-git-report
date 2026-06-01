# @weekly-git-report/cli

CLI for scanning local Git repositories and generating weekly raw commit reports.

## Install

```sh
npm install -g @weekly-git-report/cli
```

## Usage

```sh
weekly init
weekly scan --root E:/workspace/project
weekly list
weekly collect --since 2026-06-01 --until 2026-06-07
```

The CLI stores config in `~/.weekly-git-report/config.json` and writes reports to `outputRoot`.
