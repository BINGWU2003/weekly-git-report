import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

type SkillTarget = "claude" | "codex" | "opencode";

interface SkillInstallOptions {
  force: boolean;
  target?: SkillTarget;
}

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
    console.log("  1. opencode (.opencode/skill/weekly-git-report/SKILL.md)");
    console.log("  2. claude (.claude/skill/weekly-git-report/SKILL.md)");
    console.log("  3. codex (.codex/skill/weekly-git-report/SKILL.md)");
    const answer = await prompt.question("? Target model/client (opencode): ");
    return parseSkillTarget(answer.trim() || "opencode");
  } finally {
    prompt.close();
  }
}

async function installSkill(options: Required<SkillInstallOptions>): Promise<void> {
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

function getSkillFilePath(target: SkillTarget): string {
  const rootDir = `.${target}`;

  return path.resolve(
    process.cwd(),
    rootDir,
    "skill",
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
