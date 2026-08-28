import { readFile } from "node:fs/promises";

import {
  initializeSummaryTemplate,
  readSummaryTemplate,
  resetSummaryTemplate,
  saveSummaryTemplate,
} from "@weekly-git-report/core";

import {
  parseTemplateReadArgs,
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
      if (args.length > 0) throw new Error(`Unknown templates init option: ${args[0]}`);
      printJson(await initializeSummaryTemplate());
      return;
    case "read": {
      const { period } = parseTemplateReadArgs(args);
      printJson(await readSummaryTemplate(period ? { period } : {}));
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
          expectedRevision: parsed.revision ?? null,
          force: parsed.force,
        }),
      );
      return;
    }
    case "reset":
      parseTemplateResetArgs(args);
      printJson(await resetSummaryTemplate({ force: true }));
      return;
    default:
      throw new Error(`Unknown templates command: ${subcommandName ?? ""}`);
  }
}
