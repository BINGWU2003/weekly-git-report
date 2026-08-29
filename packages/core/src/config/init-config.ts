import { mkdir, writeFile } from "node:fs/promises";

import type { Config, ReportCadence } from "@weekly-git-report/shared";

import { initializeSummaryTemplates } from "../template/summary-template.js";
import {
  getConfigFilePath,
  getOutputRoot,
  getRawDir,
  getSummaryDir,
  getWorkDir,
} from "../utils/path.js";

export interface InitConfigResult {
  workDir: string;
  configFile: string;
  outputRoot: string;
  rawDir: string;
  summaryDir: string;
  summaryTemplateFile: string;
  summaryTemplateFiles: Record<ReportCadence, string>;
  createdConfig: boolean;
  createdSummaryTemplate: boolean;
  createdSummaryTemplates: ReportCadence[];
}

export interface InitConfigOptions {
  writeConfig?: boolean;
}

export async function initConfig(
  config: Config,
  options: InitConfigOptions = {},
): Promise<InitConfigResult> {
  const workDir = getWorkDir();
  const configFile = getConfigFilePath();
  const outputRoot = getOutputRoot(config.outputRoot);
  const rawDir = getRawDir(config.outputRoot);
  const summaryDir = getSummaryDir(config.outputRoot);

  await mkdir(workDir, { recursive: true });
  await mkdir(rawDir, { recursive: true });
  await mkdir(summaryDir, { recursive: true });

  const createdConfig =
    options.writeConfig === false ? false : await writeConfigIfMissing(configFile, config);
  const summaryTemplates = await initializeSummaryTemplates();
  const templatesByCadence = Object.fromEntries(
    summaryTemplates.templates.map((result) => [result.type, result]),
  ) as Record<ReportCadence, (typeof summaryTemplates.templates)[number]>;
  const createdSummaryTemplates = summaryTemplates.templates
    .filter((result) => result.created)
    .map((result) => result.type);

  return {
    workDir,
    configFile,
    outputRoot,
    rawDir,
    summaryDir,
    summaryTemplateFile: templatesByCadence.weekly.template.path,
    summaryTemplateFiles: {
      daily: templatesByCadence.daily.template.path,
      weekly: templatesByCadence.weekly.template.path,
      monthly: templatesByCadence.monthly.template.path,
    },
    createdConfig,
    createdSummaryTemplate: templatesByCadence.weekly.created,
    createdSummaryTemplates,
  };
}

async function writeConfigIfMissing(configFile: string, config: Config): Promise<boolean> {
  try {
    await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      return false;
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
