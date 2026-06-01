import { createInterface } from "node:readline/promises";

import {
  ConfigNotFoundError,
  createDefaultConfig,
  initConfig,
  loadConfig,
} from "@weekly-git-report/core";
import type { Config } from "@weekly-git-report/shared";

export async function runInitCommand(): Promise<void> {
  const config = await getInitConfig();
  const result = await initConfig(config);

  if (result.createdConfig) {
    console.log(`Created config: ${result.configFile}`);
  } else {
    console.log(`Config already exists: ${result.configFile}`);
  }

  console.log(`Roots: ${config.roots.join(", ")}`);
  console.log(`Work dir: ${result.workDir}`);
  console.log(`Output root: ${result.outputRoot}`);
  console.log(`Raw dir: ${result.rawDir}`);
  console.log(`Summary dir: ${result.summaryDir}`);
}

async function getInitConfig(): Promise<Config> {
  try {
    return await loadConfig();
  } catch (error) {
    if (error instanceof ConfigNotFoundError) {
      return await promptInitConfig(createDefaultConfig());
    }

    throw error;
  }
}

async function promptInitConfig(defaultConfig: Config): Promise<Config> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return defaultConfig;
  }

  console.log("Initialize weekly-git-report config");

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const rootsAnswer = await prompt.question(
      `? Project roots (separate multiple paths with ，) (${defaultConfig.roots.join("，")}): `,
    );
    const outputRootAnswer = await prompt.question(
      `? Output root (${defaultConfig.outputRoot}): `,
    );

    return {
      ...defaultConfig,
      roots: parseRoots(rootsAnswer, defaultConfig.roots),
      outputRoot: outputRootAnswer.trim() || defaultConfig.outputRoot,
    };
  } finally {
    prompt.close();
  }
}

function parseRoots(answer: string, defaultRoots: string[]): string[] {
  const roots = answer
    .split(/[，,]/)
    .map((root) => root.trim())
    .filter(Boolean);

  return roots.length > 0 ? roots : defaultRoots;
}
