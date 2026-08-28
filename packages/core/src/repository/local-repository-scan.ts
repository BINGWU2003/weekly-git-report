import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import type { RepositoryFolderScanResult, RepositoryScanWarning } from "@weekly-git-report/shared";

import { runGit, tryRunGit } from "../git/git-command.js";
import { normalizeAbsolutePath } from "../utils/path.js";

export interface ScanRepositoryFolderOptions {
  maxDepth?: number;
  maxRepositories?: number;
}

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_REPOSITORIES = 200;
const IGNORED_DIRECTORIES = new Set(["node_modules", "dist", "build", "out", "coverage", "target"]);

export async function scanRepositoryFolder(
  inputRoot: string,
  options: ScanRepositoryFolderOptions = {},
): Promise<RepositoryFolderScanResult> {
  const root = normalizeAbsolutePath(inputRoot);
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxRepositories = options.maxRepositories ?? DEFAULT_MAX_REPOSITORIES;
  if (maxDepth < 0) throw new Error("Repository scan depth must not be negative.");
  if (maxRepositories < 1) throw new Error("Repository scan limit must be positive.");

  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`Repository scan root must be a real directory: ${root}`);
  }

  const result: RepositoryFolderScanResult = {
    root,
    scannedDirectories: 0,
    repositories: [],
    warnings: [],
    truncated: false,
  };

  await walk(root, 0);
  return result;

  async function walk(current: string, depth: number): Promise<boolean> {
    if (result.repositories.length >= maxRepositories) {
      result.truncated = true;
      return true;
    }

    result.scannedDirectories += 1;
    const repository = await inspectMarkedRepository(current, result.warnings);
    if (repository) {
      result.repositories.push(repository);
      if (result.repositories.length >= maxRepositories) {
        result.truncated = true;
        return true;
      }
      return false;
    }
    if (depth >= maxDepth) return false;

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      result.warnings.push({ path: current, message: getErrorMessage(error) });
      return false;
    }

    for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".") || IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
      const child = path.join(current, entry.name);
      try {
        const childStat = await lstat(child);
        if (childStat.isSymbolicLink()) continue;
      } catch (error) {
        result.warnings.push({ path: child, message: getErrorMessage(error) });
        continue;
      }
      if (await walk(child, depth + 1)) return true;
    }
    return false;
  }
}

async function inspectMarkedRepository(
  directory: string,
  warnings: RepositoryScanWarning[],
): Promise<{ sourcePath: string; isBare: boolean; originUrl?: string } | undefined> {
  try {
    if (!(await hasRepositoryMarker(directory))) return undefined;
    const gitDirectory = await runGit(["rev-parse", "--git-dir"], directory);
    if (!gitDirectory) return undefined;
    const isBare = (await runGit(["rev-parse", "--is-bare-repository"], directory)) === "true";
    const originUrl = await tryRunGit(["remote", "get-url", "origin"], directory);
    return {
      sourcePath: normalizeAbsolutePath(directory),
      isBare,
      ...(originUrl ? { originUrl } : {}),
    };
  } catch (error) {
    warnings.push({ path: directory, message: getErrorMessage(error) });
    return undefined;
  }
}

async function hasRepositoryMarker(directory: string): Promise<boolean> {
  if (await pathExists(path.join(directory, ".git"))) return true;
  const markers = await Promise.all(
    ["HEAD", "objects", "refs"].map((name) => pathExists(path.join(directory, name))),
  );
  return markers.every(Boolean);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
