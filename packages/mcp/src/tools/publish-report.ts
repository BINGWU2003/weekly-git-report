import { PublishReportInputSchema } from "@weekly-git-report/shared";
import { getReportRun, publishReportRun } from "@weekly-git-report/workflow";

export async function publishReport(input: unknown) {
  const args = PublishReportInputSchema.parse(input);
  try {
    return await publishReportRun(args.runId);
  } catch (error) {
    const run = getReportRun(args.runId);
    if (run.status === "publish_failed") return run;
    throw error;
  }
}
