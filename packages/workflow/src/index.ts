import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildProjectIndex,
  collectCommits,
  getProjectsFilePath,
  loadConfig,
  loadProjectsIndex,
  resolveAuthor,
  writeProjectsIndex,
  writeReport,
} from "@weekly-git-report/core";
import {
  CollectGitLogsInputSchema,
  GetWeekIndexInputSchema,
  ListProjectsInputSchema,
  ReadWeekRawInputSchema,
  SaveWeekSummaryInputSchema,
  ScanProjectsInputSchema,
} from "@weekly-git-report/shared";

import {
  getSafeWeekSummaryFile,
  readWeekIndexFile,
  readWeekProjectFiles,
} from "./path-security.js";

export async function listProjects(input: unknown) {
  ListProjectsInputSchema.parse(input);
  const index = await loadProjectsIndex();

  return {
    projects: index.projects.map((project) => ({
      id: project.id,
      name: project.name,
      path: project.path,
      remote: project.remote,
      branch: project.branch,
    })),
  };
}

export async function scanProjects(input: unknown) {
  const args = ScanProjectsInputSchema.parse(input);
  const config = await loadConfig();
  const result = await buildProjectIndex(config, args);

  await writeProjectsIndex(result.index);

  return {
    projectCount: result.index.projects.length,
    projectsFile: getProjectsFilePath(),
    warnings: result.warnings,
  };
}

export async function collectGitLogs(input: unknown) {
  const args = CollectGitLogsInputSchema.parse(input);
  const config = await loadConfig();
  const projectsIndex = await loadProjectsIndex();
  const selected = new Set(args.projectIds);
  const projects =
    args.projectIds.length === 0
      ? projectsIndex.projects
      : projectsIndex.projects.filter(
          (project) => selected.has(project.id) || selected.has(project.name),
        );
  const authors = await resolveAuthor(config, args.author);
  const period = { start: args.since, end: args.until };
  const collectResult = await collectCommits({ projects, period, authors });
  const report = await writeReport({
    config,
    period,
    collectResult,
    backup: false,
  });

  return {
    outputDir: report.outputDir,
    indexFile: report.indexFile,
    manifestFile: report.manifestFile,
    projectCount: report.projectCount,
    commitCount: report.commitCount,
    errors: report.errors,
  };
}

export async function getWeekIndex(input: unknown) {
  const period = GetWeekIndexInputSchema.parse(input);
  const config = await loadConfig();

  return {
    content: await readWeekIndexFile(config.outputRoot, period),
  };
}

export async function readWeekRaw(input: unknown) {
  const period = ReadWeekRawInputSchema.parse(input);
  const config = await loadConfig();

  return {
    files: await readWeekProjectFiles(config.outputRoot, period),
  };
}

export async function saveWeekSummary(input: unknown) {
  const args = SaveWeekSummaryInputSchema.parse(input);
  const config = await loadConfig();
  const summaryFile = getSafeWeekSummaryFile(config.outputRoot, args);
  const content = args.content.endsWith("\n") ? args.content : `${args.content}\n`;

  await mkdir(path.dirname(summaryFile), { recursive: true });
  await writeFile(summaryFile, content, "utf8");

  return {
    summaryFile,
    bytes: Buffer.byteLength(content, "utf8"),
  };
}
