import type { Config } from "@weekly-git-report/shared";

import { tryRunGit } from "../git/git-command.js";

export async function resolveAuthor(
  config: Config,
  cliAuthors: string[] = [],
  cwd = process.cwd(),
): Promise<string[]> {
  if (cliAuthors.length > 0) {
    return normalizeAuthors(cliAuthors);
  }

  if (config.author.length > 0) {
    return normalizeAuthors(config.author);
  }

  const gitAuthor = await tryRunGit(["config", "user.name"], cwd);
  return gitAuthor?.trim() ? [gitAuthor.trim()] : [];
}

function normalizeAuthors(authors: string[]): string[] {
  return [...new Set(authors.map((author) => author.trim()).filter(Boolean))];
}
