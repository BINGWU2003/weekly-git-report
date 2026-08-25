import os from "node:os";
import path from "node:path";

import {
  CONFIG_FILE_NAME,
  PROJECTS_FILE_NAME,
  RAW_DIR_NAME,
  SUMMARY_DIR_NAME,
  WORK_DIR,
} from "@weekly-git-report/shared";
import type { Period } from "@weekly-git-report/shared";

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
