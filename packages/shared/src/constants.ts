export const WORK_DIR = "~/.weekly-git-report";
export const CONFIG_FILE_NAME = "config.json";
export const PROJECTS_FILE_NAME = "projects.json";
export const DEFAULT_OUTPUT_ROOT = "~/weekly-reports";

export const DEFAULT_EXCLUDE_DIRS = [
  "node_modules",
  ".cache",
  "dist",
  "build",
  "vendor",
  "tmp",
] as const;

export const DEFAULT_CONFIG = {
  roots: ["~/work", "~/Code", "~/Projects"],
  excludeDirs: [...DEFAULT_EXCLUDE_DIRS],
  maxDepth: 5,
  outputRoot: DEFAULT_OUTPUT_ROOT,
  author: "",
  defaultSince: "last monday",
  defaultUntil: "now",
  includeEmptyProjects: false,
} as const;

export const RAW_DIR_NAME = "raw";
export const SUMMARY_DIR_NAME = "summary";
export const HISTORY_DIR_NAME = ".history";
export const MANIFEST_FILE_NAME = "manifest.json";
export const INDEX_FILE_NAME = "index.md";
