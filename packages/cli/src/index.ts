#!/usr/bin/env node

import { runDoctorCommand } from "./commands/doctor.js";
import { runAiCommand } from "./commands/ai.js";
import { runFeishuCommand } from "./commands/feishu.js";
import { runRunsCommand } from "./commands/runs.js";
import { runTasksCommand } from "./commands/tasks.js";
import { runEditConfigCommand, runInitCommand } from "./commands/init.js";
import { runCollectCommand, runRawCommand, runSummaryCommand } from "./commands/report.js";
import { runTemplatesCommand } from "./commands/templates.js";
import {
  runAddProjectCommand,
  runEditProjectCommand,
  runImportProjectsCommand,
  runListProjectsCommand,
  runRemoveProjectCommand,
  runSyncProjectsCommand,
} from "./commands/projects.js";
import { handleCliError } from "./utils/error.js";
import { promptOptions, prompts } from "./utils/prompt.js";

const [command, ...commandArgs] = process.argv.slice(2);

try {
  switch (command) {
    case undefined:
      await runMenu();
      break;
    case "init":
      await runInitCommand();
      break;
    case "config": {
      const [configSubcommand] = commandArgs;
      if (configSubcommand !== "edit") {
        throw new Error(`Unknown config command: ${configSubcommand ?? ""}`);
      }
      await runEditConfigCommand();
      break;
    }
    case "projects":
      await runProjectsCommand(commandArgs[0], commandArgs.slice(1));
      break;
    case "collect":
      await runCollectCommand(commandArgs);
      break;
    case "raw":
      await runRawCommand(commandArgs[0], commandArgs.slice(1));
      break;
    case "summary":
      await runSummaryCommand(commandArgs[0], commandArgs.slice(1));
      break;
    case "templates":
      await runTemplatesCommand(commandArgs[0], commandArgs.slice(1));
      break;
    case "doctor":
      await runDoctorCommand();
      break;
    case "ai":
      await runAiCommand(commandArgs[0], commandArgs.slice(1));
      break;
    case "feishu":
      await runFeishuCommand(commandArgs[0], commandArgs.slice(1));
      break;
    case "tasks":
      await runTasksCommand(commandArgs[0], commandArgs.slice(1));
      break;
    case "runs":
      await runRunsCommand(commandArgs[0], commandArgs.slice(1));
      break;
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  handleCliError(error);
}

async function runMenu(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    printHelp();
    return;
  }
  const answer = await prompts(
    {
      type: "select",
      name: "action",
      message: "weekly-git-report",
      choices: [
        { title: "Initialize configuration", value: "init" },
        { title: "Edit global configuration", value: "config" },
        { title: "Add repository", value: "add" },
        { title: "Import repositories from folder", value: "import" },
        { title: "Edit repository", value: "edit" },
        { title: "Remove repository", value: "remove" },
        { title: "List repositories", value: "list" },
        { title: "Sync repositories", value: "sync" },
        { title: "Doctor", value: "doctor" },
      ],
    },
    promptOptions(),
  );
  switch (answer.action) {
    case "init":
      return runInitCommand();
    case "config":
      return runEditConfigCommand();
    case "add":
      return runAddProjectCommand();
    case "edit":
      return runEditProjectCommand();
    case "remove":
      return runRemoveProjectCommand();
    case "list":
      return runListProjectsCommand();
    case "import":
      return runImportProjectsCommand([]);
    case "sync":
      return runSyncProjectsCommand([]);
    case "doctor":
      return runDoctorCommand();
  }
}

async function runProjectsCommand(
  subcommandName: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommandName) {
    case "add":
      return runAddProjectCommand();
    case "edit":
      return runEditProjectCommand();
    case "remove":
      return runRemoveProjectCommand();
    case "list":
      return runListProjectsCommand();
    case "import":
      return runImportProjectsCommand(args);
    case "sync":
      return runSyncProjectsCommand(args);
    default:
      throw new Error(`Unknown projects command: ${subcommandName ?? ""}`);
  }
}

function printHelp(): void {
  console.log(`weekly-git-report

Usage:
  weekly
  weekly init
  weekly config edit
  weekly projects add|edit|remove|list
  weekly projects import [folder] [--all]
  weekly projects sync [id-or-name|--project <id-or-name>|--all]
  weekly collect --since <YYYY-MM-DD> --until <YYYY-MM-DD> [--author <name-or-email>] [--project <id-or-name>] [--all]
  weekly raw index --start <YYYY-MM-DD> --end <YYYY-MM-DD>
  weekly raw read --start <YYYY-MM-DD> --end <YYYY-MM-DD>
  weekly summary save [--type daily|weekly|monthly|custom] --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--title <title>] [--report-id <id>] [--file <path>] [--force]
  weekly templates init [--type daily|weekly|monthly|custom|--all]
  weekly templates read [--type daily|weekly|monthly|custom] [--start <YYYY-MM-DD> --end <YYYY-MM-DD>]
  weekly templates write [--type daily|weekly|monthly|custom] [--file <path>] (--revision <revision>|--force)
  weekly templates reset [--type daily|weekly|monthly|custom] --force
  weekly doctor
  weekly ai configure [--provider openai|deepseek|custom] [--base-url <url>] --model <id> [--accept-data-sharing]
  weekly ai status|test|clear
  weekly feishu configure|status|test|clear
  weekly tasks list|add|edit|remove|enable|disable|run|execute|schedule
  weekly runs prepare [--type daily|weekly|monthly|custom] [--start <YYYY-MM-DD> --end <YYYY-MM-DD>] [--title <title>] [--report-id <id>]
  weekly runs complete|fail|list|show|retry|cancel|publish
`);
}
