#!/usr/bin/env node

import { ConfigNotFoundError, ProjectsIndexNotFoundError } from "@weekly-git-report/core";

import { runCollectCommand } from "./commands/collect.js";
import { runInitCommand } from "./commands/init.js";
import { runListCommand } from "./commands/list.js";
import { runScanCommand } from "./commands/scan.js";

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case "init":
      await runInitCommand();
      break;
    case "scan":
      await runScanCommand(args);
      break;
    case "list":
      await runListCommand();
      break;
    case "collect":
      await runCollectCommand(args);
      break;
    case undefined:
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      console.error(`Command not implemented yet: ${command}`);
      process.exitCode = 1;
  }
} catch (error) {
  if (error instanceof ConfigNotFoundError) {
    console.error("Config not found. Please run: weekly init");
    process.exitCode = 1;
  } else if (error instanceof ProjectsIndexNotFoundError) {
    console.error("Projects index not found. Please run: weekly scan");
    process.exitCode = 1;
  } else {
    throw error;
  }
}

function printHelp(): void {
  console.log(`weekly-git-report

Usage:
  weekly init
  weekly scan
  weekly list
  weekly collect
`);
}
