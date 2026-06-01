import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

export async function tryRunGit(
  args: string[],
  cwd: string,
): Promise<string | undefined> {
  try {
    const output = await runGit(args, cwd);
    return output || undefined;
  } catch {
    return undefined;
  }
}
