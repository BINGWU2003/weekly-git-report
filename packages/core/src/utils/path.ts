import os from "node:os";
import path from "node:path";

import {
  AI_CONFIG_FILE_NAME,
  CONFIG_FILE_NAME,
  CUSTOM_TEMPLATE_DIR_NAME,
  DAILY_TEMPLATE_DIR_NAME,
  FEISHU_CONFIG_FILE_NAME,
  MONTHLY_TEMPLATE_DIR_NAME,
  PROJECTS_FILE_NAME,
  RUNS_DATABASE_FILE_NAME,
  RUNS_DIR_NAME,
  RAW_DIR_NAME,
  SUMMARY_TEMPLATE_FILE_NAME,
  SUMMARY_DIR_NAME,
  TASKS_FILE_NAME,
  TEMPLATES_DIR_NAME,
  WEEKLY_TEMPLATE_DIR_NAME,
  WORK_DIR,
} from "@weekly-git-report/shared";
import type { Period, ReportType } from "@weekly-git-report/shared";

export function expandHomePath(inputPath: string): string {
  if (inputPath === "~") {
    return os.homedir();
  }

  if (inputPath.startsWith("~/") || inputPath.startsWith("~\\")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

export function normalizeAbsolutePath(inputPath: string): string {
  return path.resolve(expandHomePath(inputPath));
}

export function getWorkDir(): string {
  return normalizeAbsolutePath(WORK_DIR);
}

export function getConfigFilePath(): string {
  return path.join(getWorkDir(), CONFIG_FILE_NAME);
}

export function getProjectsFilePath(): string {
  return path.join(getWorkDir(), PROJECTS_FILE_NAME);
}

export function getAiConfigFilePath(): string {
  return path.join(getWorkDir(), AI_CONFIG_FILE_NAME);
}

export function getFeishuConfigFilePath(): string {
  return path.join(getWorkDir(), FEISHU_CONFIG_FILE_NAME);
}

export function getTasksFilePath(): string {
  return path.join(getWorkDir(), TASKS_FILE_NAME);
}

export function getRunsDatabaseFilePath(): string {
  return path.join(getWorkDir(), RUNS_DATABASE_FILE_NAME);
}

export function getRunsDir(): string {
  return path.join(getWorkDir(), RUNS_DIR_NAME);
}

export function getRunDir(runId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error("Invalid run id.");
  return path.join(getRunsDir(), runId);
}

export function getTemplatesDir(): string {
  return path.join(getWorkDir(), TEMPLATES_DIR_NAME);
}

export function getWeeklyTemplateDir(): string {
  return getTemplateDir("weekly");
}

export function getTemplateDir(reportType: ReportType): string {
  const directory = {
    daily: DAILY_TEMPLATE_DIR_NAME,
    weekly: WEEKLY_TEMPLATE_DIR_NAME,
    monthly: MONTHLY_TEMPLATE_DIR_NAME,
    custom: CUSTOM_TEMPLATE_DIR_NAME,
  }[reportType];
  return path.join(getTemplatesDir(), directory);
}

export function getSummaryTemplateFilePath(reportType: ReportType = "weekly"): string {
  return path.join(getTemplateDir(reportType), SUMMARY_TEMPLATE_FILE_NAME);
}

export function getRepositoryCacheRoot(repositoryCacheRoot: string): string {
  return normalizeAbsolutePath(repositoryCacheRoot);
}

export function getOutputRoot(outputRoot: string): string {
  return normalizeAbsolutePath(outputRoot);
}

export function getRawDir(outputRoot: string): string {
  return path.join(getOutputRoot(outputRoot), RAW_DIR_NAME);
}

export function getSummaryDir(outputRoot: string): string {
  return path.join(getOutputRoot(outputRoot), SUMMARY_DIR_NAME);
}

export function getPeriodOutputDir(outputRoot: string, period: Period): string {
  const [year, month] = period.start.split("-");

  if (!year || !month) {
    throw new Error(`Invalid period start: ${period.start}`);
  }

  return path.join(
    normalizeAbsolutePath(outputRoot),
    RAW_DIR_NAME,
    year,
    month,
    `${period.start}_${period.end}`,
  );
}
