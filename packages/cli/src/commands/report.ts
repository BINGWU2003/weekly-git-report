import { readFile } from "node:fs/promises";

import {
  collectGitLogs,
  getWeekIndex,
  readWeekRaw,
  saveSummary,
} from "@weekly-git-report/workflow";

import { parseCollectArgs, parsePeriodArgs, parseSummarySaveArgs } from "../utils/args.js";
import { printOperationResult, printJson, readStdin } from "../utils/output.js";

export async function runCollectCommand(args: string[]): Promise<void> {
  printOperationResult(await collectGitLogs(parseCollectArgs(args)));
}

export async function runRawCommand(
  subcommandName: string | undefined,
  args: string[],
): Promise<void> {
  const period = parsePeriodArgs(args);

  switch (subcommandName) {
    case "index":
      printJson(await getWeekIndex(period));
      break;
    case "read":
      printJson(await readWeekRaw(period));
      break;
    default:
      throw new Error(`Unknown raw command: ${subcommandName ?? ""}`);
  }
}

export async function runSummaryCommand(
  subcommandName: string | undefined,
  args: string[],
): Promise<void> {
  if (subcommandName !== "save") {
    throw new Error(`Unknown summary command: ${subcommandName ?? ""}`);
  }

  const { file, period, cadence, force } = parseSummarySaveArgs(args);
  const content = file ? await readFile(file, "utf8") : await readStdin();
  printJson(await saveSummary({ ...period, content, cadence, force }));
}
