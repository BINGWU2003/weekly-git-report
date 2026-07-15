#!/usr/bin/env node

import { runInstallCommand } from "./commands/install.js";

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case undefined:
    case "install":
      await runInstallCommand(args);
      break;
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}

function printHelp(): void {
  console.log(`weekly-git-report Skill installer

Usage:
  weekly-skill install [--target <opencode|claude|codex|all>] [--force]
`);
}
