import { lstat, realpath, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Config, RepositoryProject } from "@weekly-git-report/shared";

import {
  loadProjectsIndexSnapshot,
  writeProjectsIndexIfRevision,
} from "../manifest/projects-index.js";
import type { ProjectsIndexSnapshot } from "../manifest/projects-index.js";
import { runGit } from "../git/git-command.js";
import {
  getProjectsFilePath,
  getRepositoryCacheRoot,
  getWorkDir,
  normalizeAbsolutePath,
} from "../utils/path.js";
import { FileRevisionConflictError } from "../utils/versioned-json.js";
import { normalizeRepositoryUrl } from "./repository-config.js";
import { syncRepository } from "./sync-repository.js";

export interface SaveRepositoryProjectOptions {
  project: RepositoryProject;
  currentId?: string;
  expectedRevision: string;
  projectsFile?: string;
}

export interface RemoveRepositoryProjectOptions {
  id: string;
  deleteCache: boolean;
  expectedRevision: string;
  config: Config;
  projectsFile?: string;
}

export function assertUniqueRepositoryProject(
  project: RepositoryProject,
  existing: RepositoryProject[],
): void {
  if (existing.some((item) => item.id === project.id)) {
    throw new Error(`Repository URL already configured: ${project.url}`);
  }

  const localPath = normalizeAbsolutePath(project.localPath).toLowerCase();
  if (existing.some((item) => normalizeAbsolutePath(item.localPath).toLowerCase() === localPath)) {
    throw new Error(`Local path already used by another repository: ${project.localPath}`);
  }

  if (
    existing.some(
      (item) => normalizeRepositoryUrl(item.url) === normalizeRepositoryUrl(project.url),
    )
  ) {
    throw new Error(`Repository URL already configured: ${project.url}`);
  }
}

export async function saveRepositoryProject(
  options: SaveRepositoryProjectOptions,
): Promise<ProjectsIndexSnapshot> {
  const snapshot = await loadProjectsIndexSnapshot(options.projectsFile);
  if (snapshot.revision !== options.expectedRevision) {
    throw new FileRevisionConflictError(options.projectsFile ?? getProjectsFilePath());
  }

  const current = options.currentId
    ? snapshot.index.projects.find((project) => project.id === options.currentId)
    : undefined;
  if (options.currentId && !current) throw new Error("Repository not found.");
  if (current && current.url !== options.project.url) {
    throw new Error("Repository URL cannot be changed. Remove and add the repository again.");
  }

  assertUniqueRepositoryProject(
    options.project,
    snapshot.index.projects.filter((project) => project.id !== options.currentId),
  );
  await syncRepository(options.project);

  const projects = current
    ? snapshot.index.projects.map((project) =>
        project.id === options.currentId ? options.project : project,
      )
    : [...snapshot.index.projects, options.project];
  return writeProjectsIndexIfRevision({ projects }, options.expectedRevision, options.projectsFile);
}

export async function setRepositoryEnabled(
  id: string,
  enabled: boolean,
  expectedRevision: string,
  projectsFile?: string,
): Promise<ProjectsIndexSnapshot> {
  const snapshot = await loadProjectsIndexSnapshot(projectsFile);
  if (!snapshot.index.projects.some((project) => project.id === id)) {
    throw new Error("Repository not found.");
  }
  return writeProjectsIndexIfRevision(
    {
      projects: snapshot.index.projects.map((project) =>
        project.id === id ? { ...project, enabled } : project,
      ),
    },
    expectedRevision,
    projectsFile,
  );
}

export async function removeRepositoryProject(
  options: RemoveRepositoryProjectOptions,
): Promise<ProjectsIndexSnapshot> {
  const snapshot = await loadProjectsIndexSnapshot(options.projectsFile);
  if (snapshot.revision !== options.expectedRevision) {
    throw new FileRevisionConflictError(options.projectsFile ?? getProjectsFilePath());
  }
  const project = snapshot.index.projects.find((item) => item.id === options.id);
  if (!project) throw new Error("Repository not found.");

  const next = {
    projects: snapshot.index.projects.filter((item) => item.id !== options.id),
  };
  if (!options.deleteCache) {
    return writeProjectsIndexIfRevision(next, options.expectedRevision, options.projectsFile);
  }

  const repositoryPath = await validateRepositoryCacheForDeletion(project, options.config);
  const quarantinePath = `${repositoryPath}.delete-${process.pid}-${Date.now()}`;
  await rename(repositoryPath, quarantinePath);
  let result: ProjectsIndexSnapshot;
  try {
    result = await writeProjectsIndexIfRevision(
      next,
      options.expectedRevision,
      options.projectsFile,
    );
  } catch (error) {
    await rename(quarantinePath, repositoryPath).catch(() => undefined);
    throw error;
  }

  try {
    await rm(quarantinePath, { recursive: true, force: true });
    return result;
  } catch (error) {
    await rename(quarantinePath, repositoryPath).catch(() => undefined);
    await writeProjectsIndexIfRevision(snapshot.index, result.revision, options.projectsFile).catch(
      () => undefined,
    );
    throw error;
  }
}

async function validateRepositoryCacheForDeletion(
  project: RepositoryProject,
  config: Config,
): Promise<string> {
  const configuredPath = normalizeAbsolutePath(project.localPath);
  const fileStat = await lstat(configuredPath);
  if (!fileStat.isDirectory() || fileStat.isSymbolicLink()) {
    throw new Error(`Repository cache must be a real directory: ${configuredPath}`);
  }

  const repositoryPath = await realpath(configuredPath);
  const protectedPaths = [
    path.parse(repositoryPath).root,
    os.homedir(),
    process.cwd(),
    getWorkDir(),
    getRepositoryCacheRoot(config.repositoryCacheRoot),
  ].map((item) => normalizeAbsolutePath(item).toLowerCase());
  if (protectedPaths.includes(repositoryPath.toLowerCase())) {
    throw new Error(`Refusing to delete protected path: ${repositoryPath}`);
  }

  const bare = await runGit(["rev-parse", "--is-bare-repository"], repositoryPath);
  if (bare !== "true") {
    throw new Error(`Repository cache is not a bare Git repository: ${repositoryPath}`);
  }
  const remote = await runGit(["remote", "get-url", "origin"], repositoryPath);
  if (normalizeRepositoryUrl(remote) !== normalizeRepositoryUrl(project.url)) {
    throw new Error(`Origin remote does not match configured URL: ${repositoryPath}`);
  }
  return repositoryPath;
}
