import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { ConfigSchema } from "@weekly-git-report/shared";
import type { Config } from "@weekly-git-report/shared";

import { getConfigFilePath } from "../utils/path.js";

export class ConfigNotFoundError extends Error {
  constructor(configFile = getConfigFilePath()) {
    super(`Config not found: ${configFile}`);
    this.name = "ConfigNotFoundError";
  }
}

export async function loadConfig(configFile = getConfigFilePath()): Promise<Config> {
  let content: string;

  try {
    content = await readFile(configFile, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new ConfigNotFoundError(configFile);
    }

    throw error;
  }

  return ConfigSchema.parse(JSON.parse(content));
}

export async function writeConfig(config: Config, configFile = getConfigFilePath()): Promise<void> {
  const parsed = ConfigSchema.parse(config);
  await writeJsonAtomic(configFile, parsed);
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporaryFile, file);
  } catch (error) {
    await rm(temporaryFile, { force: true });
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
