import path from "node:path";

import type { Config, Project, ProjectsIndex } from "@weekly-git-report/shared";

import { tryRunGit } from "../git/git-command.js";
import { findGitProjects } from "./find-git-projects.js";

export interface ScanProjectsOptions {
  roots?: string[];
  maxDepth?: number;
}

export interface ScanProjectsResult {
  index: ProjectsIndex;
  warnings: string[];
}

export async function buildProjectIndex(
  config: Config,
  options: ScanProjectsOptions = {},
): Promise<ScanProjectsResult> {
  const scanResult = await findGitProjects({
    roots: options.roots ?? config.roots,
    excludeDirs: config.excludeDirs,
    maxDepth: options.maxDepth ?? config.maxDepth,
  });

  const projects = await Promise.all(scanResult.paths.map(buildProject));

  return {
    index: {
      version: 1,
      generatedAt: new Date().toISOString(),
      projects: dedupeProjects(projects),
    },
    warnings: scanResult.warnings,
  };
}

async function buildProject(projectPath: string): Promise<Project> {
  const remote = await tryRunGit(["remote", "get-url", "origin"], projectPath);
  const branch = await tryRunGit(["branch", "--show-current"], projectPath);
  const lastCommitAt = await tryRunGit(["log", "-1", "--format=%cI"], projectPath);
  const name = path.basename(projectPath);

  return {
    id: remote ? remoteToId(remote) : projectPath,
    name,
    fileName: `${sanitizeFileBaseName(name)}.md`,
    path: projectPath,
    remote,
    branch,
    lastCommitAt,
    isDuplicate: false,
  };
}

function dedupeProjects(projects: Project[]): Project[] {
  const byId = new Map<string, Project>();

  for (const project of projects) {
    const existing = byId.get(project.id);
    if (!existing || isNewerProject(project, existing)) {
      byId.set(project.id, project);
    }
  }

  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function isNewerProject(candidate: Project, current: Project): boolean {
  if (!candidate.lastCommitAt) {
    return false;
  }

  if (!current.lastCommitAt) {
    return true;
  }

  return candidate.lastCommitAt > current.lastCommitAt;
}

function remoteToId(remote: string): string {
  const trimmed = remote.trim();
  const sshMatch = /^git@([^:]+):(.+)$/.exec(trimmed);
  if (sshMatch) {
    return stripGitSuffix(`${sshMatch[1]}/${sshMatch[2]}`);
  }

  try {
    const url = new URL(trimmed);
    return stripGitSuffix(`${url.host}${url.pathname}`);
  } catch {
    return stripGitSuffix(trimmed);
  }
}

function stripGitSuffix(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.git$/, "");
}

function sanitizeFileBaseName(value: string): string {
  const sanitized = value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "-");
  return sanitized || "project";
}
