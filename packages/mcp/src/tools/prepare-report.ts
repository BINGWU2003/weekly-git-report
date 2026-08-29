import { PrepareReportInputSchema } from "@weekly-git-report/shared";
import type { ReportType } from "@weekly-git-report/shared";
import { prepareReportRun, resolveCurrentPeriod } from "@weekly-git-report/workflow";

export async function prepareReport(input: unknown) {
  const args = PrepareReportInputSchema.parse(input);
  const period =
    args.period ?? resolveCurrentPeriod(args.reportType as Exclude<ReportType, "custom">);
  const prepared = await prepareReportRun({
    reportType: args.reportType,
    period,
    generator: "external-agent",
    trigger: "external-agent",
    projectIds: args.projectIds,
    ...(args.title ? { title: args.title } : {}),
    ...(args.reportId ? { reportId: args.reportId } : {}),
    ...(args.userContext ? { userContext: args.userContext } : {}),
  });

  return {
    runId: prepared.run.id,
    run: prepared.run,
    template: prepared.template,
    generationInput: prepared.generationInput,
  };
}
