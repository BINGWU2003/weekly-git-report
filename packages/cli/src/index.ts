#!/usr/bin/env node

import { runDoctorCommand } from "./commands/doctor.js";
import { runEditConfigCommand, runInitCommand } from "./commands/init.js";
import {
  runAddProjectCommand,
  runEditProjectCommand,
  runListProjectsCommand,
  runRemoveProjectCommand,
  runSyncProjectsCommand,
} from "./commands/projects.js";
import { promptOptions, prompts } from "./utils/prompt.js";

const [command, subcommand, ...commandArgs] = process.argv.slice(2);

try {
  switch (command) {
    case undefined:
      await runMenu();
      break;
    case "init":
      await runInitCommand();
      break;
    case "config":
      if (subcommand !== "edit") throw new Error(`Unknown config command: ${subcommand ?? ""}`);
      await runEditConfigCommand();
      break;
    case "projects":
      await runProjectsCommand(subcommand, commandArgs);
      break;
    case "doctor":
      await runDoctorCommand();
      break;
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
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
    case "sync":
      return runSyncProjectsCommand();
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
    case "sync":
      return runSyncProjectsCommand(args[0]);
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
  weekly projects sync [id-or-name]
  weekly doctor
`);
}
