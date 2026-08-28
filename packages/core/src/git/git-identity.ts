import type { Identity } from "@weekly-git-report/shared";

import { tryRunGit } from "./git-command.js";

export async function getGlobalGitIdentity(): Promise<Identity | null> {
  const [name, email] = await Promise.all([
    tryRunGit(["config", "--global", "user.name"], process.cwd()),
    tryRunGit(["config", "--global", "user.email"], process.cwd()),
  ]);
  if (!name || !email) return null;
  return { name, email };
}
