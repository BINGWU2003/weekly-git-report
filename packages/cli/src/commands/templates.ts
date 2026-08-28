import { readFile } from "node:fs/promises";

import {
  initializeSummaryTemplate,
  initializeSummaryTemplates,
  readSummaryTemplate,
  resetSummaryTemplate,
  saveSummaryTemplate,
} from "@weekly-git-report/core";

import {
  parseTemplateReadArgs,
  parseTemplateInitArgs,
  parseTemplateResetArgs,
  parseTemplateWriteArgs,
} from "../utils/args.js";
import { printJson, readStdin } from "../utils/output.js";

export async function runTemplatesCommand(
  subcommandName: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommandName) {
    case "init":
      {
        const parsed = parseTemplateInitArgs(args);
        printJson(
          parsed.all
            ? await initializeSummaryTemplates()
            : await initializeSummaryTemplate({ cadence: parsed.cadence }),
        );
      }
      return;
    case "read": {
      const { cadence, period } = parseTemplateReadArgs(args);
      printJson(await readSummaryTemplate({ cadence, ...(period ? { period } : {}) }));
      return;
    }
    case "write": {
      const parsed = parseTemplateWriteArgs(args);
      const content = parsed.file
        ? await readFile(parsed.file, "utf8")
        : await readStdin(
            process.stdin,
            "Missing template content. Pass --file or pipe Markdown to stdin.",
          );
      printJson(
        await saveSummaryTemplate({
          content,
          cadence: parsed.cadence,
          expectedRevision: parsed.revision ?? null,
          force: parsed.force,
        }),
      );
      return;
    }
    case "reset":
      {
        const parsed = parseTemplateResetArgs(args);
        printJson(await resetSummaryTemplate({ force: true, cadence: parsed.cadence }));
      }
      return;
    default:
      throw new Error(`Unknown templates command: ${subcommandName ?? ""}`);
  }
}
