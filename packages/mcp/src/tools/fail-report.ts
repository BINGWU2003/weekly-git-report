import { FailReportInputSchema } from "@weekly-git-report/shared";
import { failExternalRun } from "@weekly-git-report/workflow";

export function failReport(input: unknown) {
  const args = FailReportInputSchema.parse(input);
  return failExternalRun(args.runId, args.message);
}
