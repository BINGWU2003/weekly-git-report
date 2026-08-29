import { CompleteReportInputSchema } from "@weekly-git-report/shared";
import { completeExternalRun, getReportRun } from "@weekly-git-report/workflow";

export async function completeReport(input: unknown) {
  const args = CompleteReportInputSchema.parse(input);
  try {
    return await completeExternalRun(args.runId, args.content, {
      publish: args.publish,
      force: args.force,
    });
  } catch (error) {
    const run = getReportRun(args.runId);
    if (run.status === "publish_failed") return run;
    throw error;
  }
}
