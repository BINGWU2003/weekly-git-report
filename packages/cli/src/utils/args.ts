import { ReportTypeSchema } from "@weekly-git-report/shared";
import type { ReportType } from "@weekly-git-report/shared";

export interface ProjectSelection {
  explicit: boolean;
  projectIds: string[];
}

export interface ProjectImportArgs {
  all: boolean;
  folder?: string;
}

export interface TemplateReadArgs {
  reportType: ReportType;
  period?: { start: string; end: string };
}

export interface TemplateWriteArgs {
  reportType: ReportType;
  file?: string;
  revision?: string;
  force: boolean;
}

export function parseProjectImportArgs(args: string[]): ProjectImportArgs {
  let all = false;
  let folder: string | undefined;
  for (const arg of args) {
    if (arg === "--all") {
      if (all) throw new Error("--all cannot be repeated.");
      all = true;
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown projects import option: ${arg}`);
    if (folder) throw new Error("Pass only one folder to projects import.");
    folder = arg;
  }
  return { all, folder };
}

export function parseCollectArgs(args: string[]): unknown {
  const parsed: {
    author: string[];
    projectIds: string[];
    since?: string;
    until?: string;
  } = { author: [], projectIds: [] };
  let all = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--since") {
      parsed.since = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--until") {
      parsed.until = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--author") {
      parsed.author.push(readOptionValue(args, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--project") {
      if (all) throw new Error("--project cannot be combined with --all.");
      parsed.projectIds.push(readOptionValue(args, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--all") {
      if (all || parsed.projectIds.length > 0) {
        throw new Error("--all cannot be repeated or combined with --project.");
      }
      all = true;
      continue;
    }
    throw new Error(`Unknown collect option: ${arg}`);
  }

  return parsed;
}

export function parseProjectSelectionArgs(args: string[]): ProjectSelection {
  const projectIds: string[] = [];
  let all = false;
  let positional = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--project") {
      if (all || positional) {
        throw new Error("--project cannot be combined with --all or a positional project.");
      }
      projectIds.push(readOptionValue(args, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--all") {
      if (all || projectIds.length > 0) {
        throw new Error("--all cannot be repeated or combined with a project selection.");
      }
      all = true;
      continue;
    }
    if (arg?.startsWith("-")) {
      throw new Error(`Unknown projects sync option: ${arg}`);
    }
    if (all || projectIds.length > 0) {
      throw new Error("Pass one positional project, repeated --project options, or --all.");
    }
    if (arg) {
      positional = true;
      projectIds.push(arg);
    }
  }

  return { explicit: args.length > 0, projectIds };
}

export function parsePeriodArgs(args: string[]): { start?: string; end?: string } {
  let start: string | undefined;
  let end: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--start" || arg === "--since") {
      start = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--end" || arg === "--until") {
      end = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown period option: ${arg}`);
  }

  return { start, end };
}

export function parseSummarySaveArgs(args: string[]): {
  file?: string;
  period: { start?: string; end?: string };
  reportType: ReportType;
  title?: string;
  reportId?: string;
  force: boolean;
} {
  const periodArgs: string[] = [];
  let file: string | undefined;
  let reportType: ReportType = "weekly";
  let reportTypeSet = false;
  let title: string | undefined;
  let reportId: string | undefined;
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--file") {
      file = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--type") {
      if (reportTypeSet) throw new Error("--type cannot be repeated.");
      reportType = parseReportType(readOptionValue(args, index, arg));
      reportTypeSet = true;
      index += 1;
      continue;
    }
    if (arg === "--title") {
      title = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--report-id") {
      reportId = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--force") {
      if (force) throw new Error("--force cannot be repeated.");
      force = true;
      continue;
    }
    if (arg) periodArgs.push(arg);
  }

  return {
    file,
    period: parsePeriodArgs(periodArgs),
    reportType,
    ...(title ? { title } : {}),
    ...(reportId ? { reportId } : {}),
    force,
  };
}

export function parseTemplateReadArgs(args: string[]): TemplateReadArgs {
  const { reportType, remaining } = extractReportType(args);
  const period = parsePeriodArgs(remaining);
  if ((period.start && !period.end) || (!period.start && period.end)) {
    throw new Error("--start and --end must be provided together.");
  }
  return period.start && period.end
    ? { reportType, period: { start: period.start, end: period.end } }
    : { reportType };
}

export function parseTemplateWriteArgs(args: string[]): TemplateWriteArgs {
  let file: string | undefined;
  let revision: string | undefined;
  let force = false;
  let reportType: ReportType = "weekly";
  let reportTypeSet = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--file") {
      if (file) throw new Error("--file cannot be repeated.");
      file = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--revision") {
      if (revision) throw new Error("--revision cannot be repeated.");
      revision = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--force") {
      if (force) throw new Error("--force cannot be repeated.");
      force = true;
      continue;
    }
    if (arg === "--type") {
      if (reportTypeSet) throw new Error("--type cannot be repeated.");
      reportType = parseReportType(readOptionValue(args, index, arg));
      reportTypeSet = true;
      index += 1;
      continue;
    }
    throw new Error(`Unknown templates write option: ${arg}`);
  }

  if (revision && force) throw new Error("--revision cannot be combined with --force.");
  if (!revision && !force) throw new Error("Pass --revision <revision> or --force.");
  return {
    reportType,
    ...(file ? { file } : {}),
    ...(revision ? { revision } : {}),
    force,
  };
}

export function parseTemplateResetArgs(args: string[]): { force: true; reportType: ReportType } {
  const { reportType, remaining } = extractReportType(args);
  if (remaining.length !== 1 || remaining[0] !== "--force") {
    throw new Error("templates reset requires --force and accepts an optional --type.");
  }
  return { force: true, reportType };
}

export function parseTemplateInitArgs(args: string[]): {
  all: boolean;
  reportType: ReportType;
} {
  if (args.includes("--all")) {
    if (args.length !== 1) throw new Error("--all cannot be combined with other options.");
    return { all: true, reportType: "weekly" };
  }
  const { reportType, remaining } = extractReportType(args);
  if (remaining.length > 0) throw new Error(`Unknown templates init option: ${remaining[0]}`);
  return { all: false, reportType };
}

function extractReportType(args: string[]): { reportType: ReportType; remaining: string[] } {
  let reportType: ReportType = "weekly";
  let found = false;
  const remaining: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--type") {
      if (found) throw new Error("--type cannot be repeated.");
      reportType = parseReportType(readOptionValue(args, index, arg));
      found = true;
      index += 1;
    } else if (arg) {
      remaining.push(arg);
    }
  }
  return { reportType, remaining };
}

function parseReportType(value: string): ReportType {
  const result = ReportTypeSchema.safeParse(value);
  if (!result.success) throw new Error(`Invalid report type: ${value}`);
  return result.data;
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value) throw new Error(`Missing value for ${option}`);
  return value;
}
