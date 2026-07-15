#!/usr/bin/env node

import { runInitCommand } from "./commands/init.js";

const [command] = process.argv.slice(2);

switch (command) {
  case "init":
    await runInitCommand();
    break;
  case undefined:
  case "--help":
  case "-h":
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exitCode = 1;
}

function printHelp(): void {
  console.log(`weekly-git-report

Usage:
  weekly init
`);
}
