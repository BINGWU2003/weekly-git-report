import { readFile } from "node:fs/promises";

import { ReportTypeSchema } from "@weekly-git-report/shared";
import type { ReportType } from "@weekly-git-report/shared";
import {
  cancelReportRun,
  completeExternalRun,
  failExternalRun,
  getReportRun,
  listReportRuns,
  prepareReportRun,
  publishReportRun,
  resolveCurrentPeriod,
  retryReportRun,
} from "@weekly-git-report/workflow";

import { printJson, readStdin } from "../utils/output.js";

export async function runRunsCommand(
  subcommand: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "prepare":
      return prepare(args);
    case "complete":
      return complete(args);
    case "fail":
      return fail(args);
    case "list":
      return list(args);
    case "show":
      return show(args);
    case "retry":
      return retry(args);
    case "cancel":
      return cancel(args);
    case "publish":
      return publishRun(args);
    default:
      throw new Error(`Unknown runs command: ${subcommand ?? ""}`);
  }
}

async function prepare(args: string[]): Promise<void> {
  const parsed = parsePrepareArgs(args);
  if (parsed.reportType === "custom" && !parsed.period) {
    throw new Error("Custom reports require --start and --end.");
  }
  const result = await prepareReportRun({
    reportType: parsed.reportType,
    period:
      parsed.period ?? resolveCurrentPeriod(parsed.reportType as Exclude<ReportType, "custom">),
    ...(parsed.reportId ? { reportId: parsed.reportId } : {}),
    ...(parsed.title ? { title: parsed.title } : {}),
    generator: "external-agent",
    trigger: "external-agent",
    projectIds: parsed.projectIds,
    ...(parsed.userContext ? { userContext: parsed.userContext } : {}),
  });
  printJson({
    runId: result.run.id,
    run: result.run,
    template: result.template,
    generationInput: result.generationInput,
    generationInputFile: result.generationInputFile,
  });
}

async function complete(args: string[]): Promise<void> {
  const runId = requiredRunId(args);
  const file = option(args.slice(1), "--file");
  const publish = args.includes("--publish");
  const force = args.includes("--force");
  rejectRunOptions(args.slice(1), ["--file", "--publish", "--force"]);
  const content = file ? await readFile(file, "utf8") : await readStdin();
  printJson(await completeExternalRun(runId, content, { publish, force }));
}

async function fail(args: string[]): Promise<void> {
  const runId = requiredRunId(args);
  const message = option(args.slice(1), "--message") ?? "External Agent reported a failure.";
  rejectRunOptions(args.slice(1), ["--message"]);
  printJson(failExternalRun(runId, message));
}

async function list(args: string[]): Promise<void> {
  const limitValue = option(args, "--limit");
  rejectRunOptions(args, ["--limit"]);
  printJson({ runs: listReportRuns(limitValue ? Number(limitValue) : undefined) });
}

async function show(args: string[]): Promise<void> {
  const id = requiredRunId(args);
  if (args.length !== 1) throw new Error(`Unexpected argument: ${args[1]}`);
  printJson(getReportRun(id));
}

async function retry(args: string[]): Promise<void> {
  const id = requiredRunId(args);
  if (args.length !== 1) throw new Error(`Unexpected argument: ${args[1]}`);
  printJson(await retryReportRun(id));
}

async function cancel(args: string[]): Promise<void> {
  const id = requiredRunId(args);
  if (args.length !== 1) throw new Error(`Unexpected argument: ${args[1]}`);
  printJson(cancelReportRun(id));
}

async function publishRun(args: string[]): Promise<void> {
  const id = requiredRunId(args);
  if (args.length !== 1) throw new Error(`Unexpected argument: ${args[1]}`);
  printJson(await publishReportRun(id));
}

function parsePrepareArgs(args: string[]) {
  let reportType: ReportType = "weekly";
  let start: string | undefined;
  let end: string | undefined;
  let userContext: string | undefined;
  let title: string | undefined;
  let reportId: string | undefined;
  const projectIds: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const next = () => {
      const value = args[++index];
      if (!value) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    if (arg === "--type") reportType = ReportTypeSchema.parse(next());
    else if (arg === "--start") start = next();
    else if (arg === "--end") end = next();
    else if (arg === "--title") title = next();
    else if (arg === "--report-id") reportId = next();
    else if (arg === "--project") projectIds.push(next());
    else if (arg === "--context") userContext = next();
    else throw new Error(`Unknown runs prepare option: ${arg}`);
  }
  if (Boolean(start) !== Boolean(end))
    throw new Error("--start and --end must be provided together.");
  return {
    reportType,
    projectIds,
    ...(title ? { title } : {}),
    ...(reportId ? { reportId } : {}),
    ...(userContext ? { userContext } : {}),
    ...(start && end ? { period: { start, end } } : {}),
  };
}

function requiredRunId(args: string[]): string {
  const id = args[0];
  if (!id || id.startsWith("-")) throw new Error("Run id is required.");
  return id;
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return value;
}

function rejectRunOptions(args: string[], allowed: string[]): void {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!allowed.includes(arg)) throw new Error(`Unknown option: ${arg}`);
    if (arg !== "--publish" && arg !== "--force") index += 1;
  }
}
