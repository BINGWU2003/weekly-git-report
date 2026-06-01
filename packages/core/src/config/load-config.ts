import { readFile } from "node:fs/promises";

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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
