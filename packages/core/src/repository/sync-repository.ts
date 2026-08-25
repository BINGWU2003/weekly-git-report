import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import type { ManifestError, Project, RepositoryProject } from "@weekly-git-report/shared";

import { runGit, tryRunGit } from "../git/git-command.js";
import { normalizeAbsolutePath } from "../utils/path.js";
import {
  assertSafeRepositoryUrl,
  normalizeRepositoryUrl,
  toRuntimeProject,
} from "./repository-config.js";

export interface RemoteRepositoryInfo {
  defaultBranch?: string;
  branches: string[];
}

export interface SyncRepositoriesResult {
  projects: Project[];
  errors: ManifestError[];
}

export async function inspectRemoteRepository(
  repositoryUrl: string,
): Promise<RemoteRepositoryInfo> {
  assertSafeRepositoryUrl(repositoryUrl);
  const output = await runGit(
    ["ls-remote", "--symref", repositoryUrl, "HEAD", "refs/heads/*"],
    process.cwd(),
  );
  let defaultBranch: string | undefined;
  const branches = new Set<string>();

  for (const line of output.split(/\r?\n/)) {
    const headMatch = /^ref:\s+refs\/heads\/(.+)\tHEAD$/.exec(line);
    if (headMatch?.[1]) {
      defaultBranch = headMatch[1];
      continue;
    }

    const branchMatch = /^[^\s]+\s+refs\/heads\/(.+)$/.exec(line);
    if (branchMatch?.[1]) {
      branches.add(branchMatch[1]);
    }
  }

  return { defaultBranch, branches: [...branches].toSorted() };
}

export async function syncRepositories(
  repositories: RepositoryProject[],
): Promise<SyncRepositoriesResult> {
  const projects: Project[] = [];
  const errors: ManifestError[] = [];

  for (const repository of repositories) {
    try {
      projects.push(await syncRepository(repository));
    } catch (error) {
      errors.push({
        projectId: repository.id,
        name: repository.name,
        path: repository.localPath,
        message: getErrorMessage(error),
      });
    }
  }

  return { projects, errors };
}

export async function syncRepository(repository: RepositoryProject): Promise<Project> {
  assertSafeRepositoryUrl(repository.url);
  await runGit(["check-ref-format", "--branch", repository.branch], process.cwd());
  const project = toRuntimeProject(repository);
  const repositoryPath = normalizeAbsolutePath(project.localPath);
  const state = await inspectLocalPath(repositoryPath);

  if (state === "missing") {
    await createBareRepository(repository, repositoryPath);
  } else if (state === "empty") {
    await initializeBareRepository(repository, repositoryPath);
  } else if (state === "repository") {
    await assertMatchingRemote(repository, repositoryPath);
    await fetchBranch(repository, repositoryPath);
  } else {
    throw new Error(`Local path is a non-empty non-Git directory: ${repositoryPath}`);
  }

  return project;
}

async function createBareRepository(
  repository: RepositoryProject,
  repositoryPath: string,
): Promise<void> {
  await mkdir(path.dirname(repositoryPath), { recursive: true });
  const temporaryPath = `${repositoryPath}.clone-${process.pid}-${Date.now()}`;
  try {
    await initializeBareRepository(repository, temporaryPath);
    await rename(temporaryPath, repositoryPath);
  } catch (error) {
    await rm(temporaryPath, { recursive: true, force: true });
    throw error;
  }
}

async function initializeBareRepository(
  repository: RepositoryProject,
  repositoryPath: string,
): Promise<void> {
  await mkdir(repositoryPath, { recursive: true });
  await runGit(["init", "--bare"], repositoryPath);
  await runGit(["remote", "add", "origin", repository.url], repositoryPath);
  await fetchBranch(repository, repositoryPath);
}

async function assertMatchingRemote(
  repository: RepositoryProject,
  repositoryPath: string,
): Promise<void> {
  const remote = await tryRunGit(["remote", "get-url", "origin"], repositoryPath);
  if (!remote) {
    throw new Error(`Git repository has no origin remote: ${repositoryPath}`);
  }

  if (normalizeRepositoryUrl(remote) !== normalizeRepositoryUrl(repository.url)) {
    throw new Error(`Origin remote does not match configured URL: ${repositoryPath}`);
  }
}

async function fetchBranch(repository: RepositoryProject, repositoryPath: string): Promise<void> {
  await runGit(
    [
      "fetch",
      "--filter=blob:none",
      "--prune",
      "origin",
      `+refs/heads/${repository.branch}:refs/remotes/origin/${repository.branch}`,
    ],
    repositoryPath,
  );
}

async function inspectLocalPath(
  repositoryPath: string,
): Promise<"empty" | "missing" | "other" | "repository"> {
  try {
    const targetStat = await stat(repositoryPath);
    if (!targetStat.isDirectory()) return "other";
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return "missing";
    throw error;
  }

  if (await tryRunGit(["rev-parse", "--git-dir"], repositoryPath)) {
    return "repository";
  }

  return (await readdir(repositoryPath)).length === 0 ? "empty" : "other";
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
