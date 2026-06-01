import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadConfig } from "@weekly-git-report/core";
import { SaveWeekSummaryInputSchema } from "@weekly-git-report/shared";

import { getSafeWeekSummaryFile } from "./path-security.js";

export async function saveWeekSummary(input: unknown) {
  const args = SaveWeekSummaryInputSchema.parse(input);
  const config = await loadConfig();
  const summaryFile = getSafeWeekSummaryFile(config.outputRoot, args);
  const content = args.content.endsWith("\n") ? args.content : `${args.content}\n`;

  await mkdir(path.dirname(summaryFile), { recursive: true });
  await writeFile(summaryFile, content, "utf8");

  return {
    summaryFile,
    bytes: Buffer.byteLength(content, "utf8"),
  };
}
