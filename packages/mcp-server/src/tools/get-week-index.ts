import { loadConfig } from "@weekly-git-report/core";
import { GetWeekIndexInputSchema } from "@weekly-git-report/shared";

import { readWeekIndexFile } from "./path-security.js";

export async function getWeekIndex(input: unknown) {
  const period = GetWeekIndexInputSchema.parse(input);
  const config = await loadConfig();

  return {
    content: await readWeekIndexFile(config.outputRoot, period),
  };
}
