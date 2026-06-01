#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { ConfigNotFoundError, ProjectsIndexNotFoundError } from "@weekly-git-report/core";
import {
  collectGitLogs,
  getWeekIndex,
  listProjects,
  readWeekRaw,
  saveWeekSummary,
  scanProjects,
} from "@weekly-git-report/workflow";

const [command, subcommand, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case "projects":
      await runProjectsCommand(subcommand, args);
      break;
    case "collect":
      await printJson(await collectGitLogs(parseCollectArgs(subcommand ? [subcommand, ...args] : args)));
      break;
    case "raw":
      await runRawCommand(subcommand, args);
      break;
    case "summary":
      await runSummaryCommand(subcommand, args);
      break;
    case undefined:
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  handleError(error);
}

async function runProjectsCommand(
  subcommandName: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommandName) {
    case "list":
      await printJson(await listProjects({}));
      break;
    case "scan":
      await printJson(await scanProjects(parseScanArgs(args)));
      break;
    default:
      throw new Error(`Unknown projects command: ${subcommandName ?? ""}`);
  }
}

async function runRawCommand(
  subcommandName: string | undefined,
  args: string[],
): Promise<void> {
  const period = parsePeriodArgs(args);

  switch (subcommandName) {
    case "index":
      await printJson(await getWeekIndex(period));
      break;
    case "read":
      await printJson(await readWeekRaw(period));
      break;
    default:
      throw new Error(`Unknown raw command: ${subcommandName ?? ""}`);
  }
}

async function runSummaryCommand(
  subcommandName: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommandName) {
    case "save": {
      const { file, period } = parseSummarySaveArgs(args);
      const content = file ? await readFile(file, "utf8") : await readStdin();
      await printJson(await saveWeekSummary({ ...period, content }));
      break;
    }
    default:
      throw new Error(`Unknown summary command: ${subcommandName ?? ""}`);
  }
}

function parseCollectArgs(args: string[]): unknown {
  const parsed: {
    author: string[];
    projectIds: string[];
    since?: string;
    until?: string;
  } = { author: [], projectIds: [] };

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
      parsed.projectIds.push(readOptionValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--all") {
      parsed.projectIds = [];
      continue;
    }

    throw new Error(`Unknown collect option: ${arg}`);
  }

  return parsed;
}

function parseScanArgs(args: string[]): unknown {
  const roots: string[] = [];
  let maxDepth: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--root") {
      roots.push(readOptionValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--max-depth") {
      maxDepth = Number(readOptionValue(args, index, arg));
      index += 1;
      continue;
    }

    throw new Error(`Unknown projects scan option: ${arg}`);
  }

  return {
    ...(roots.length > 0 ? { roots } : {}),
    ...(maxDepth !== undefined ? { maxDepth } : {}),
  };
}

function parsePeriodArgs(args: string[]) {
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

function parseSummarySaveArgs(args: string[]) {
  const periodArgs: string[] = [];
  let file: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--file") {
      file = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (!arg) {
      continue;
    }

    periodArgs.push(arg);
  }

  return { file, period: parsePeriodArgs(periodArgs) };
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`Missing value for ${option}`);
  }

  return value;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new Error("Missing summary content. Pass --file or pipe Markdown to stdin.");
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function printJson(data: unknown): Promise<void> {
  console.log(JSON.stringify(data, null, 2));
}

function handleError(error: unknown): void {
  if (error instanceof ConfigNotFoundError) {
    console.error("Config not found. Please run: weekly init");
    process.exitCode = 1;
  } else if (error instanceof ProjectsIndexNotFoundError) {
    console.error("Projects index not found. Please run: weekly scan");
    process.exitCode = 1;
  } else if (error instanceof Error) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}

function printHelp(): void {
  console.log(`weekly-git-report agent CLI

Usage:
  weekly-agent projects list
  weekly-agent projects scan [--root <path>] [--max-depth <number>]
  weekly-agent collect --since <YYYY-MM-DD> --until <YYYY-MM-DD> [--author <name>] [--project <id>] [--all]
  weekly-agent raw index --start <YYYY-MM-DD> --end <YYYY-MM-DD>
  weekly-agent raw read --start <YYYY-MM-DD> --end <YYYY-MM-DD>
  weekly-agent summary save --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--file <path>]
`);
}
