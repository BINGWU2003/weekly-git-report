import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { intro, outro, promptOptions, prompts } from "../utils/prompt.js";

type SkillTarget = "all" | "claude" | "codex" | "opencode";

const SKILL_TARGETS = ["opencode", "claude", "codex"] as const;

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

    if (arg === "--target") {
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

  intro("weekly-git-report skill");

  const answer = await prompts(
    {
      type: "select",
      name: "target",
      message: "Target client",
      initial: 0,
      choices: [
        {
          title: "opencode",
          description: ".opencode/skill/weekly-git-report/SKILL.md",
          value: "opencode",
        },
        {
          title: "claude",
          description: ".claude/skill/weekly-git-report/SKILL.md",
          value: "claude",
        },
        {
          title: "codex",
          description: ".codex/skill/weekly-git-report/SKILL.md",
          value: "codex",
        },
        {
          title: "all",
          description: "Install all targets",
          value: "all",
        },
      ],
    },
    promptOptions(),
  );

  return parseSkillTarget(String(answer.target ?? "opencode"));
}

async function installSkill(options: Required<SkillInstallOptions>): Promise<void> {
  if (options.target === "all") {
    for (const target of SKILL_TARGETS) {
      await installSkillFile(target, options.force);
    }

    outro("All skills installed.");
    return;
  }

  await installSkillFile(options.target, options.force);
  outro("Skill installed.");
}

async function installSkillFile(
  targetName: Exclude<SkillTarget, "all">,
  force: boolean,
): Promise<void> {
  const target = getSkillFilePath(targetName);
  const source = getSkillTemplatePath();

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await readFile(source, "utf8"), {
    encoding: "utf8",
    flag: force ? "w" : "wx",
  });

  console.log(`Installed ${targetName} skill: ${target}`);
  console.log(`Restart ${getRestartTargetName(targetName)} to load the new skill.`);
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

  if (normalized === "all") {
    return "all";
  }

  if (normalized === "1" || normalized === "opencode") {
    return "opencode";
  }

  if (normalized === "2" || normalized === "claude") {
    return "claude";
  }

  if (normalized === "3" || normalized === "codex") {
    return "codex";
  }

  throw new Error("Target must be one of: opencode, claude, codex, all");
}

function getRestartTargetName(target: Exclude<SkillTarget, "all">): string {
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
