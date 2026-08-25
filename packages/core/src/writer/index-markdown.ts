import type { Manifest, ManifestProject } from "@weekly-git-report/shared";

export function renderIndexMarkdown(manifest: Manifest): string {
  const totalCommits = manifest.projects.reduce((total, project) => total + project.commitCount, 0);

  return `# Git 原始记录索引

- 周期：${manifest.period.start} ~ ${manifest.period.end}
- 采集时间：${formatDateTime(manifest.generatedAt)}
- 输出目录：${manifest.outputDir}
- 项目数量：${manifest.projects.length}
- 总 Commit 数：${totalCommits}

## 项目列表

${renderProjectTable(manifest.projects)}

## Agent 读取建议

请先读取本文件，了解本周期包含的项目列表。
然后根据“项目列表”中的文件路径逐个读取项目 Markdown 文件。
总结时只基于这些 Git 提交记录，不要编造未出现的信息。
`;
}

function renderProjectTable(projects: ManifestProject[]): string {
  if (projects.length === 0) {
    return "本周期无项目提交记录。";
  }

  const rows = projects.map(
    (project) =>
      `| ${project.name} | ${project.file} | ${project.remote ?? ""} | ${project.branch ?? ""} | ${project.commitCount} |`,
  );

  return [
    "| 项目 | 文件 | Remote | Branch | Commit 数 |",
    "| ---- | ---- | ------ | ------ | --------- |",
    ...rows,
  ].join("\n");
}

function formatDateTime(value: string): string {
  return value.replace("T", " ").slice(0, 19);
}
