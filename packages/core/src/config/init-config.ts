import { mkdir, writeFile } from "node:fs/promises";

import type { Config } from "@weekly-git-report/shared";

import { initializeSummaryTemplate } from "../template/summary-template.js";
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
  createdConfig: boolean;
  createdSummaryTemplate: boolean;
}

export async function initConfig(config: Config): Promise<InitConfigResult> {
  const workDir = getWorkDir();
  const configFile = getConfigFilePath();
  const outputRoot = getOutputRoot(config.outputRoot);
  const rawDir = getRawDir(config.outputRoot);
  const summaryDir = getSummaryDir(config.outputRoot);

  await mkdir(workDir, { recursive: true });
  await mkdir(rawDir, { recursive: true });
  await mkdir(summaryDir, { recursive: true });

  const createdConfig = await writeConfigIfMissing(configFile, config);
  const summaryTemplate = await initializeSummaryTemplate();

  return {
    workDir,
    configFile,
    outputRoot,
    rawDir,
    summaryDir,
    summaryTemplateFile: summaryTemplate.template.path,
    createdConfig,
    createdSummaryTemplate: summaryTemplate.created,
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
