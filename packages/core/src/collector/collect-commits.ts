import type { ManifestError, Period, Project } from "@weekly-git-report/shared";

import { runGit } from "../git/git-command.js";

export interface GitCommit {
  committedAt: string;
  hash: string;
  author: string;
  subject: string;
}

export interface ProjectCommitResult {
  project: Project;
  commits: GitCommit[];
}

export interface CollectCommitsOptions {
  projects: Project[];
  period: Period;
  authors?: string[];
}

export interface CollectCommitsResult {
  projects: ProjectCommitResult[];
  errors: ManifestError[];
}

export async function collectCommits(
  options: CollectCommitsOptions,
): Promise<CollectCommitsResult> {
  const projects: ProjectCommitResult[] = [];
  const errors: ManifestError[] = [];

  for (const project of options.projects) {
    try {
      const commits = await collectProjectCommits(project, options.period, options.authors ?? []);
      projects.push({ project, commits });
    } catch (error) {
      errors.push({
        projectId: project.id,
        name: project.name,
        path: project.path,
        message: getErrorMessage(error),
      });
    }
  }

  return { projects, errors };
}

async function collectProjectCommits(
  project: Project,
  period: Period,
  authors: string[],
): Promise<GitCommit[]> {
  if (authors.length === 0) {
    return collectProjectCommitsByAuthor(project, period);
  }

  const commitsByHash = new Map<string, GitCommit>();

  for (const author of authors) {
    const commits = await collectProjectCommitsByAuthor(project, period, author);
    for (const commit of commits) {
      commitsByHash.set(commit.hash, commit);
    }
  }

  return [...commitsByHash.values()].sort((left, right) =>
    right.committedAt.localeCompare(left.committedAt),
  );
}

async function collectProjectCommitsByAuthor(
  project: Project,
  period: Period,
  author?: string,
): Promise<GitCommit[]> {
  const args = [
    "log",
    `--since=${period.start} 00:00:00`,
    `--until=${period.end} 23:59:59`,
    "--pretty=format:%cI%x1f%h%x1f%an%x1f%s",
  ];

  if (author) {
    args.splice(3, 0, `--author=${author}`);
  }

  const output = await runGit(args, project.path);
  return parseGitLog(output);
}

function parseGitLog(output: string): GitCommit[] {
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [committedAt = "", hash = "", author = "", subject = ""] = line.split("\x1f");
      return { committedAt, hash, author, subject };
    });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const maybeStderr = (error as Error & { stderr?: unknown }).stderr;
    if (typeof maybeStderr === "string" && maybeStderr.trim()) {
      return maybeStderr.trim();
    }

    return error.message;
  }

  return String(error);
}
