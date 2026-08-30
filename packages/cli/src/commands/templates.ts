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
            : await initializeSummaryTemplate({ reportType: parsed.reportType }),
        );
      }
      return;
    case "read": {
      const { reportType, period } = parseTemplateReadArgs(args);
      printJson(await readSummaryTemplate({ reportType, ...(period ? { period } : {}) }));
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
          reportType: parsed.reportType,
          expectedRevision: parsed.revision ?? null,
          force: parsed.force,
        }),
      );
      return;
    }
    case "reset":
      {
        const parsed = parseTemplateResetArgs(args);
        printJson(await resetSummaryTemplate({ force: true, reportType: parsed.reportType }));
      }
      return;
    default:
      throw new Error(`Unknown templates command: ${subcommandName ?? ""}`);
  }
}
