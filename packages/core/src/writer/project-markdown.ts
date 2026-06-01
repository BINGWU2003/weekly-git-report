import type { Period, Project } from "@weekly-git-report/shared";

import type { GitCommit } from "../collector/collect-commits.js";
import { escapeMarkdownTableCell } from "../utils/markdown.js";

export interface RenderProjectMarkdownOptions {
  project: Project;
  period: Period;
  commits: GitCommit[];
  generatedAt: string;
}

export function renderProjectMarkdown(options: RenderProjectMarkdownOptions): string {
  const { project, period, commits, generatedAt } = options;

  return `# ${project.name}

- 周期：${period.start} ~ ${period.end}
- 项目路径：${project.path}
- Git Remote：${project.remote ?? ""}
- 当前分支：${project.branch ?? ""}
- 采集时间：${formatDateTime(generatedAt)}
- Commit 数：${commits.length}
- 生成策略：overwrite

## Commits

${renderCommitsTable(commits)}

## Raw

\`\`\`text
${renderRawCommits(commits)}
\`\`\`
`;
}

export function renderProjectMarkdownForHash(
  options: Omit<RenderProjectMarkdownOptions, "generatedAt">,
): string {
  return renderProjectMarkdown({ ...options, generatedAt: "" });
}

function renderCommitsTable(commits: GitCommit[]): string {
  if (commits.length === 0) {
    return "本周期无提交记录。";
  }

  const rows = commits.map((commit) => {
    const date = commit.committedAt.slice(0, 10);
    const subject = escapeMarkdownTableCell(commit.subject);
    const author = escapeMarkdownTableCell(commit.author);
    return `| ${date} | ${commit.hash} | ${author} | ${subject} |`;
  });

  return [
    "| 日期 | Hash | 作者 | Commit |",
    "| ---- | ---- | ---- | ------ |",
    ...rows,
  ].join("\n");
}

function renderRawCommits(commits: GitCommit[]): string {
  return commits
    .map(
      (commit) =>
        `${commit.committedAt} ${commit.hash} ${commit.author} ${commit.subject.replace(/\r?\n/g, " ")}`,
    )
    .join("\n");
}

function formatDateTime(value: string): string {
  if (!value) {
    return "";
  }

  return value.replace("T", " ").slice(0, 19);
}
