import { DEFAULT_CONFIG } from "@weekly-git-report/shared";
import type { Config } from "@weekly-git-report/shared";

export function createDefaultConfig(): Config {
  return {
    roots: [...DEFAULT_CONFIG.roots],
    excludeDirs: [...DEFAULT_CONFIG.excludeDirs],
    maxDepth: DEFAULT_CONFIG.maxDepth,
    outputRoot: DEFAULT_CONFIG.outputRoot,
    author: [...DEFAULT_CONFIG.author],
    defaultSince: DEFAULT_CONFIG.defaultSince,
    defaultUntil: DEFAULT_CONFIG.defaultUntil,
    includeEmptyProjects: DEFAULT_CONFIG.includeEmptyProjects,
  };
}
