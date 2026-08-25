import { DEFAULT_CONFIG } from "@weekly-git-report/shared";
import type { Config } from "@weekly-git-report/shared";

export function createDefaultConfig(): Config {
  return {
    outputRoot: DEFAULT_CONFIG.outputRoot,
    repositoryCacheRoot: DEFAULT_CONFIG.repositoryCacheRoot,
    defaultSince: DEFAULT_CONFIG.defaultSince,
    defaultUntil: DEFAULT_CONFIG.defaultUntil,
    includeEmptyProjects: DEFAULT_CONFIG.includeEmptyProjects,
    identities: [],
  };
}
