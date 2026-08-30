export const WORK_DIR = "~/.weekly-git-report";
export const CONFIG_FILE_NAME = "config.json";
export const PROJECTS_FILE_NAME = "projects.json";
export const AI_CONFIG_FILE_NAME = "ai.json";
export const FEISHU_CONFIG_FILE_NAME = "feishu.json";
export const TASKS_FILE_NAME = "tasks.json";
export const RUNS_DATABASE_FILE_NAME = "runs.db";
export const RUNS_DIR_NAME = "runs";
export const TEMPLATES_DIR_NAME = "templates";
export const DAILY_TEMPLATE_DIR_NAME = "daily";
export const WEEKLY_TEMPLATE_DIR_NAME = "weekly";
export const MONTHLY_TEMPLATE_DIR_NAME = "monthly";
export const CUSTOM_TEMPLATE_DIR_NAME = "custom";
export const SUMMARY_TEMPLATE_FILE_NAME = "summary.md";
export const SUMMARY_METADATA_SUFFIX = ".meta.json";
export const REPORT_CADENCES = ["daily", "weekly", "monthly"] as const;
export const REPORT_TYPES = [...REPORT_CADENCES, "custom"] as const;
export const DEFAULT_OUTPUT_ROOT = "~/weekly-reports";
export const DEFAULT_REPOSITORY_CACHE_ROOT = "~/.weekly-git-report/repositories";

export const DEFAULT_CONFIG = {
  outputRoot: DEFAULT_OUTPUT_ROOT,
  repositoryCacheRoot: DEFAULT_REPOSITORY_CACHE_ROOT,
  includeEmptyProjects: false,
  identities: [],
} as const;

export const RAW_DIR_NAME = "raw";
export const SUMMARY_DIR_NAME = "summary";
export const HISTORY_DIR_NAME = ".history";
export const TRASH_DIR_NAME = ".trash";
export const TRASH_MANIFEST_FILE_NAME = "trash.json";
export const MANIFEST_FILE_NAME = "manifest.json";
export const GENERATION_INPUT_FILE_NAME = "generation-input.json";
export const INDEX_FILE_NAME = "index.md";
