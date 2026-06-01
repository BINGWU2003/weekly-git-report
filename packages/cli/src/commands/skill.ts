import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function runSkillCommand(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case "install":
      await installSkill(rest.includes("--force"));
      break;
    default:
      throw new Error(`Unknown skill command: ${subcommand ?? ""}`);
  }
}

async function installSkill(force: boolean): Promise<void> {
  const target = path.resolve(
    process.cwd(),
    ".opencode",
    "skills",
    "weekly-git-report",
    "SKILL.md",
  );
  const source = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "skills",
    "weekly-git-report",
    "SKILL.md",
  );

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await readFile(source, "utf8"), {
    encoding: "utf8",
    flag: force ? "w" : "wx",
  });

  console.log(`Installed skill: ${target}`);
  console.log("Restart opencode to load the new skill.");
}
