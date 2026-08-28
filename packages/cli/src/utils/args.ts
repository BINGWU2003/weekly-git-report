export interface ProjectSelection {
  explicit: boolean;
  projectIds: string[];
}

export interface ProjectImportArgs {
  all: boolean;
  folder?: string;
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
} {
  const periodArgs: string[] = [];
  let file: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--file") {
      file = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg) periodArgs.push(arg);
  }

  return { file, period: parsePeriodArgs(periodArgs) };
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value) throw new Error(`Missing value for ${option}`);
  return value;
}
