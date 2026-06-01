import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

type SkillTarget = "claude" | "codex" | "opencode";

interface SkillInstallOptions {
  force: boolean;
  target?: SkillTarget;
}

const CODEX_START = "<!-- weekly-git-report:start -->";
const CODEX_END = "<!-- weekly-git-report:end -->";

export async function runSkillCommand(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case "install":
      await installSkill(await resolveInstallOptions(parseSkillInstallArgs(rest)));
      break;
    default:
      throw new Error(`Unknown skill command: ${subcommand ?? ""}`);
  }
}

function parseSkillInstallArgs(args: string[]): SkillInstallOptions {
  const options: SkillInstallOptions = { force: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--model" || arg === "--target") {
      options.target = parseSkillTarget(readOptionValue(args, index, arg));
      index += 1;
      continue;
    }

    throw new Error(`Unknown skill install option: ${arg}`);
  }

  return options;
}

async function resolveInstallOptions(
  options: SkillInstallOptions,
): Promise<Required<SkillInstallOptions>> {
  return {
    force: options.force,
    target: options.target ?? (await promptSkillTarget()),
  };
}

async function promptSkillTarget(): Promise<SkillTarget> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return "opencode";
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log("Install weekly-git-report skill for:");
    console.log("  1. opencode (.opencode/skills/weekly-git-report/SKILL.md)");
    console.log("  2. claude (.claude/skills/weekly-git-report/SKILL.md)");
    console.log("  3. codex (AGENTS.md)");
    const answer = await prompt.question("? Target model/client (opencode): ");
    return parseSkillTarget(answer.trim() || "opencode");
  } finally {
    prompt.close();
  }
}

async function installSkill(options: Required<SkillInstallOptions>): Promise<void> {
  if (options.target === "codex") {
    await installCodexInstructions(options.force);
    return;
  }

  const target = getSkillFilePath(options.target);
  const source = getSkillTemplatePath();

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await readFile(source, "utf8"), {
    encoding: "utf8",
    flag: options.force ? "w" : "wx",
  });

  console.log(`Installed ${options.target} skill: ${target}`);
  console.log(`Restart ${getRestartTargetName(options.target)} to load the new skill.`);
}

async function installCodexInstructions(force: boolean): Promise<void> {
  const target = path.resolve(process.cwd(), "AGENTS.md");
  const block = await renderCodexInstructions();
  const current = await readTextIfExists(target);

  if (current.includes(CODEX_START) && !force) {
    throw new Error("Codex instructions already exist. Re-run with --force to overwrite.");
  }

  const next = current.includes(CODEX_START)
    ? current.replace(createMarkedBlockRegex(), block)
    : appendMarkedBlock(current, block);

  await writeFile(target, next, "utf8");

  console.log(`Installed codex instructions: ${target}`);
  console.log("Restart Codex to load the updated AGENTS.md instructions.");
}

function getSkillFilePath(target: Exclude<SkillTarget, "codex">): string {
  const rootDir = target === "claude" ? ".claude" : ".opencode";

  return path.resolve(
    process.cwd(),
    rootDir,
    "skills",
    "weekly-git-report",
    "SKILL.md",
  );
}

function getSkillTemplatePath(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "skills",
    "weekly-git-report",
    "SKILL.md",
  );
}

async function renderCodexInstructions(): Promise<string> {
  const content = await readFile(getSkillTemplatePath(), "utf8");
  const body = content.replace(/^---[\s\S]*?---\s*/, "").trim();

  return `${CODEX_START}\n${body}\n${CODEX_END}\n`;
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

function appendMarkedBlock(current: string, block: string): string {
  const prefix = current.trimEnd();

  return prefix ? `${prefix}\n\n${block}` : block;
}

function createMarkedBlockRegex(): RegExp {
  return new RegExp(`${escapeRegExp(CODEX_START)}[\\s\\S]*?${escapeRegExp(CODEX_END)}\\n?`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseSkillTarget(value: string): SkillTarget {
  const normalized = value.trim().toLowerCase();

  if (normalized === "1" || normalized === "opencode") {
    return "opencode";
  }

  if (normalized === "2" || normalized === "claude") {
    return "claude";
  }

  if (normalized === "3" || normalized === "codex") {
    return "codex";
  }

  throw new Error("Target must be one of: opencode, claude, codex");
}

function getRestartTargetName(target: SkillTarget): string {
  switch (target) {
    case "claude":
      return "Claude Code";
    case "codex":
      return "Codex";
    case "opencode":
      return "opencode";
  }
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`Missing value for ${option}`);
  }

  return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
