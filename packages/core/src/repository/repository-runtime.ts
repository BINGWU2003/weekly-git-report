import { stat } from "node:fs/promises";

import type {
  LatestCommit,
  RepositoryProject,
  RepositoryRuntimeState,
} from "@weekly-git-report/shared";

import { runGit, tryRunGit } from "../git/git-command.js";
import { normalizeAbsolutePath } from "../utils/path.js";

const DEFAULT_CONCURRENCY = 8;

export async function getRepositoryRuntimeState(
  project: RepositoryProject,
): Promise<RepositoryRuntimeState> {
  const repositoryPath = normalizeAbsolutePath(project.localPath);
  try {
    const repositoryStat = await stat(repositoryPath);
    if (!repositoryStat.isDirectory()) {
      return runtimeError(project.id, "Repository cache path is not a directory.");
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        projectId: project.id,
        status: "not-synced",
        latestCommit: null,
        message: "Repository cache does not exist.",
      };
    }
    return runtimeError(project.id, getErrorMessage(error));
  }

  if (!(await tryRunGit(["rev-parse", "--git-dir"], repositoryPath))) {
    return runtimeError(project.id, "Repository cache is not a Git repository.");
  }

  const reference = `refs/remotes/origin/${project.branch}`;
  try {
    await runGit(["rev-parse", "--verify", `${reference}^{commit}`], repositoryPath);
  } catch {
    return {
      projectId: project.id,
      status: "missing-branch",
      latestCommit: null,
      message: `Cached branch reference is missing: ${reference}`,
    };
  }

  try {
    const output = await runGit(
      ["show", "-s", "--format=%H%x1f%s%x1f%an%x1f%ae%x1f%cI", reference],
      repositoryPath,
    );
    const [hash = "", subject = "", authorName = "", authorEmail = "", committedAt = ""] =
      output.split("\x1f");
    const latestCommit: LatestCommit = {
      hash,
      subject,
      authorName,
      authorEmail,
      committedAt,
    };
    return { projectId: project.id, status: "ready", latestCommit };
  } catch (error) {
    return runtimeError(project.id, getErrorMessage(error));
  }
}

export async function getRepositoriesRuntimeState(
  projects: RepositoryProject[],
  concurrency = DEFAULT_CONCURRENCY,
): Promise<RepositoryRuntimeState[]> {
  const results = new Array<RepositoryRuntimeState>(projects.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), projects.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < projects.length) {
        const index = nextIndex;
        nextIndex += 1;
        const project = projects[index];
        if (project) results[index] = await getRepositoryRuntimeState(project);
      }
    }),
  );
  return results;
}

function runtimeError(projectId: string, message: string): RepositoryRuntimeState {
  return { projectId, status: "error", latestCommit: null, message };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const stderr = (error as Error & { stderr?: unknown }).stderr;
    if (typeof stderr === "string" && stderr.trim()) return stderr.trim();
    return error.message;
  }
  return String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
