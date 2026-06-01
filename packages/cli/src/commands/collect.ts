import {
  collectCommits,
  loadConfig,
  loadProjectsIndex,
  resolveAuthor,
  resolvePeriod,
  writeReport,
} from "@weekly-git-report/core";
import { CollectOptionsSchema } from "@weekly-git-report/shared";
import type { Project } from "@weekly-git-report/shared";

interface RawCollectArgs {
  since?: string;
  until?: string;
  author?: string;
  projectIds: string[];
  backup: boolean;
}

export async function runCollectCommand(args: string[]): Promise<void> {
  const rawOptions = parseCollectArgs(args);
  const config = await loadConfig();
  const projectsIndex = await loadProjectsIndex();
  const period = resolvePeriod(config, rawOptions);
  const author = await resolveAuthor(config, rawOptions.author);
  const options = CollectOptionsSchema.parse({
    since: period.start,
    until: period.end,
    author,
    projectIds: rawOptions.projectIds,
    backup: rawOptions.backup,
  });
  const projects = filterProjects(projectsIndex.projects, options.projectIds);
  const result = await collectCommits({ projects, period, author: options.author });
  const report = await writeReport({
    config,
    period,
    collectResult: result,
    backup: options.backup,
  });

  for (const error of result.errors) {
    console.warn(`Warning: ${error.name ?? error.projectId ?? "project"}: ${error.message}`);
  }

  console.log(`Generated:\n${report.outputDir}\n`);
  console.log(`Projects: ${report.projectCount}`);
  console.log(`Commits: ${report.commitCount}`);
  console.log(`Updated files: ${report.updatedFiles}`);
  console.log(`Skipped files: ${report.skippedFiles}`);
  console.log(`Errors: ${report.errors.length}`);
}

function parseCollectArgs(args: string[]): RawCollectArgs {
  const parsed: RawCollectArgs = { projectIds: [], backup: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--since") {
      parsed.since = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--until") {
      parsed.until = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--author") {
      parsed.author = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--project") {
      parsed.projectIds.push(readOptionValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--all") {
      parsed.projectIds = [];
      continue;
    }

    if (arg === "--backup") {
      parsed.backup = true;
      continue;
    }

    if (arg === "--output") {
      throw new Error("weekly collect --output is not supported in the first version");
    }

    throw new Error(`Unknown collect option: ${arg}`);
  }

  return parsed;
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`Missing value for ${option}`);
  }

  return value;
}

function filterProjects(projects: Project[], projectIds: string[]): Project[] {
  if (projectIds.length === 0) {
    return projects;
  }

  const selected = new Set(projectIds);
  return projects.filter((project) => selected.has(project.id) || selected.has(project.name));
}
