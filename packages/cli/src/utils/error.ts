import { ConfigNotFoundError, ProjectsIndexNotFoundError } from "@weekly-git-report/core";

export function handleCliError(error: unknown): void {
  if (error instanceof ConfigNotFoundError) {
    console.error("Config not found. Please run: weekly init");
  } else if (error instanceof ProjectsIndexNotFoundError) {
    console.error("Projects config not found. Please run: weekly init");
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
}
