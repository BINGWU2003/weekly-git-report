export const WORK_DIR = "~/.weekly-git-report";
export const CONFIG_FILE_NAME = "config.json";
export const PROJECTS_FILE_NAME = "projects.json";
export const TEMPLATES_DIR_NAME = "templates";
export const WEEKLY_TEMPLATE_DIR_NAME = "weekly";
export const SUMMARY_TEMPLATE_FILE_NAME = "summary.md";
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
