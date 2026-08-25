export const WORK_DIR = "~/.weekly-git-report";
export const CONFIG_FILE_NAME = "config.json";
export const PROJECTS_FILE_NAME = "projects.json";
export const DEFAULT_OUTPUT_ROOT = "~/weekly-reports";
export const DEFAULT_REPOSITORY_CACHE_ROOT = "~/.weekly-git-report/repositories";

export const DEFAULT_CONFIG = {
  outputRoot: DEFAULT_OUTPUT_ROOT,
  repositoryCacheRoot: DEFAULT_REPOSITORY_CACHE_ROOT,
  defaultSince: "last monday",
  defaultUntil: "now",
  includeEmptyProjects: false,
  identities: [],
} as const;

export const RAW_DIR_NAME = "raw";
export const SUMMARY_DIR_NAME = "summary";
export const HISTORY_DIR_NAME = ".history";
export const MANIFEST_FILE_NAME = "manifest.json";
export const INDEX_FILE_NAME = "index.md";
