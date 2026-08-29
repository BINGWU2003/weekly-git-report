import type { Identity, ManifestError, Period, Project } from "@weekly-git-report/shared";

import { runGit } from "../git/git-command.js";

export interface GitCommit {
  committedAt: string;
  hash: string;
  author: string;
  authorEmail: string;
  subject: string;
  body?: string;
}

export interface ProjectCommitResult {
  project: Project;
  commits: GitCommit[];
}

export interface CollectCommitsOptions {
  projects: Project[];
  period: Period;
  authorOverrides?: string[];
  identities: Identity[];
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
      const commits = await collectProjectCommits(
        project,
        options.period,
        options.authorOverrides ?? [],
        project.authors ?? options.identities,
      );
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
  authorOverrides: string[],
  identities: Identity[],
): Promise<GitCommit[]> {
  const commits = await collectProjectCommitsFromBranch(project, period);
  return commits.filter((commit) =>
    authorOverrides.length > 0
      ? authorOverrides.some((author) => matchesAuthorOverride(commit, author))
      : identities.some(
          (identity) => identity.email.toLowerCase() === commit.authorEmail.toLowerCase(),
        ),
  );
}

async function collectProjectCommitsFromBranch(
  project: Project,
  period: Period,
): Promise<GitCommit[]> {
  const args = [
    "log",
    `refs/remotes/origin/${project.branch}`,
    `--since=${period.start} 00:00:00`,
    `--until=${period.end} 23:59:59`,
    "--pretty=format:%cI%x1f%H%x1f%an%x1f%ae%x1f%s%x1f%b%x1e",
  ];

  const output = await runGit(args, project.path);
  return parseGitLog(output);
}

function parseGitLog(output: string): GitCommit[] {
  if (!output) {
    return [];
  }

  return output
    .split("\x1e")
    .map((record) => record.replace(/^\r?\n/, "").replace(/\r?\n$/, ""))
    .filter(Boolean)
    .map((record) => {
      const [committedAt = "", hash = "", author = "", authorEmail = "", subject = "", body = ""] =
        record.split("\x1f");
      return { committedAt, hash, author, authorEmail, subject, body: body.trim() };
    });
}

function matchesAuthorOverride(commit: GitCommit, author: string): boolean {
  const normalized = author.trim().toLowerCase();
  return (
    commit.author.toLowerCase() === normalized || commit.authorEmail.toLowerCase() === normalized
  );
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
