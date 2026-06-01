import { loadConfig } from "@weekly-git-report/core";
import { ReadWeekRawInputSchema } from "@weekly-git-report/shared";

import { readWeekProjectFiles } from "./path-security.js";

export async function readWeekRaw(input: unknown) {
  const period = ReadWeekRawInputSchema.parse(input);
  const config = await loadConfig();

  return {
    files: await readWeekProjectFiles(config.outputRoot, period),
  };
}
