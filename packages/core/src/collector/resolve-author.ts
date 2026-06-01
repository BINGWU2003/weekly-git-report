import type { Config } from "@weekly-git-report/shared";

import { tryRunGit } from "../git/git-command.js";

export async function resolveAuthor(
  config: Config,
  cliAuthor?: string,
  cwd = process.cwd(),
): Promise<string | undefined> {
  if (cliAuthor?.trim()) {
    return cliAuthor.trim();
  }

  if (config.author.trim()) {
    return config.author.trim();
  }

  const gitAuthor = await tryRunGit(["config", "user.name"], cwd);
  return gitAuthor?.trim() || undefined;
}
