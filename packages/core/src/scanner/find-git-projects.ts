import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { normalizeAbsolutePath } from "../utils/path.js";

export interface FindGitProjectsOptions {
  roots: string[];
  excludeDirs: string[];
  maxDepth: number;
}

export interface FindGitProjectsResult {
  paths: string[];
  warnings: string[];
}

export async function findGitProjects(
  options: FindGitProjectsOptions,
): Promise<FindGitProjectsResult> {
  const found = new Set<string>();
  const warnings: string[] = [];

  for (const root of options.roots) {
    const rootPath = normalizeAbsolutePath(root);

    try {
      const rootStat = await stat(rootPath);
      if (!rootStat.isDirectory()) {
        warnings.push(`Root is not a directory: ${rootPath}`);
        continue;
      }
    } catch (error) {
      warnings.push(`Cannot access root: ${rootPath} (${getErrorMessage(error)})`);
      continue;
    }

    await walk(rootPath, 0, options, found, warnings);
  }

  return { paths: [...found].sort(), warnings };
}

async function walk(
  currentDir: string,
  depth: number,
  options: FindGitProjectsOptions,
  found: Set<string>,
  warnings: string[],
): Promise<void> {
  if (await hasGitEntry(currentDir)) {
    found.add(currentDir);
    return;
  }

  if (depth >= options.maxDepth) {
    return;
  }

  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    warnings.push(`Cannot read directory: ${currentDir} (${getErrorMessage(error)})`);
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || options.excludeDirs.includes(entry.name)) {
      continue;
    }

    await walk(path.join(currentDir, entry.name), depth + 1, options, found, warnings);
  }
}

async function hasGitEntry(dir: string): Promise<boolean> {
  try {
    const gitStat = await stat(path.join(dir, ".git"));
    return gitStat.isDirectory() || gitStat.isFile();
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
