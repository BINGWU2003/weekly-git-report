import { ConfigSchema } from "@weekly-git-report/shared";
import type { Config } from "@weekly-git-report/shared";

import { getConfigFilePath } from "../utils/path.js";
import { assertFileRevision, readVersionedText, writeJsonAtomic } from "../utils/versioned-json.js";

export interface ConfigSnapshot {
  config: Config;
  revision: string;
}

export class ConfigNotFoundError extends Error {
  constructor(configFile = getConfigFilePath()) {
    super(`Config not found: ${configFile}`);
    this.name = "ConfigNotFoundError";
  }
}

export async function loadConfig(configFile = getConfigFilePath()): Promise<Config> {
  return (await loadConfigSnapshot(configFile)).config;
}

export async function loadConfigSnapshot(
  configFile = getConfigFilePath(),
): Promise<ConfigSnapshot> {
  let document;

  try {
    document = await readVersionedText(configFile);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new ConfigNotFoundError(configFile);
    }

    throw error;
  }

  return {
    config: ConfigSchema.parse(JSON.parse(document.content)),
    revision: document.revision,
  };
}

export async function writeConfig(config: Config, configFile = getConfigFilePath()): Promise<void> {
  const parsed = ConfigSchema.parse(config);
  await writeJsonAtomic(configFile, parsed);
}

export async function writeConfigIfRevision(
  config: Config,
  expectedRevision: string | null,
  configFile = getConfigFilePath(),
): Promise<ConfigSnapshot> {
  const parsed = ConfigSchema.parse(config);
  await assertFileRevision(configFile, expectedRevision);
  await writeJsonAtomic(configFile, parsed);
  return loadConfigSnapshot(configFile);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
