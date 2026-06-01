import {
  ConfigNotFoundError,
  createDefaultConfig,
  initConfig,
  loadConfig,
} from "@weekly-git-report/core";
import type { Config } from "@weekly-git-report/shared";

import { intro, outro, promptOptions, prompts } from "../utils/prompt.js";

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

  intro("weekly-git-report config");

  const answers = await prompts(
    [
      {
        type: "text",
        name: "roots",
        message: "Project roots, separated by ，",
        initial: defaultConfig.roots.join("，"),
      },
      {
        type: "text",
        name: "outputRoot",
        message: "Output root",
        initial: defaultConfig.outputRoot,
      },
    ],
    promptOptions(),
  );

  outro("Config ready.");

  return {
    ...defaultConfig,
    roots: parseRoots(String(answers.roots ?? ""), defaultConfig.roots),
    outputRoot: String(answers.outputRoot ?? "").trim() || defaultConfig.outputRoot,
  };
}

function parseRoots(answer: string, defaultRoots: string[]): string[] {
  const roots = answer
    .split(/[，,]/)
    .map((root) => root.trim())
    .filter(Boolean);

  return roots.length > 0 ? roots : defaultRoots;
}
