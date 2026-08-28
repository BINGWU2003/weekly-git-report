import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RunGitOptions {
  timeoutMs?: number;
}

export async function runGit(
  args: string[],
  cwd: string,
  options: RunGitOptions = {},
): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
    ...(options.timeoutMs ? { timeout: options.timeoutMs } : {}),
  });
  return stdout.trim();
}

export async function tryRunGit(
  args: string[],
  cwd: string,
  options: RunGitOptions = {},
): Promise<string | undefined> {
  try {
    const output = await runGit(args, cwd, options);
    return output || undefined;
  } catch {
    return undefined;
  }
}
