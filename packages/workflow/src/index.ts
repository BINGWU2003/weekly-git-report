import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  collectCommits,
  getRepositoriesRuntimeState,
  loadConfig,
  loadProjectsIndex,
  syncRepositories,
  writeReport,
} from "@weekly-git-report/core";
import {
  CollectGitLogsInputSchema,
  GetWeekIndexInputSchema,
  ListProjectsInputSchema,
  ReadWeekRawInputSchema,
  SaveWeekSummaryInputSchema,
  SyncProjectsInputSchema,
} from "@weekly-git-report/shared";

import {
  getSafeWeekSummaryFile,
  readWeekIndexFile,
  readWeekProjectFiles,
} from "./path-security.js";

export async function listProjects(input: unknown) {
  ListProjectsInputSchema.parse(input);
  const index = await loadProjectsIndex();
  const runtime = await getRepositoriesRuntimeState(index.projects);
  const runtimeById = new Map(runtime.map((state) => [state.projectId, state]));

  return {
    projects: index.projects.map((project) => ({
      id: project.id,
      name: project.name,
      path: project.localPath,
      remote: project.url,
      branch: project.branch,
      enabled: project.enabled,
      authors: project.authors,
      runtime: runtimeById.get(project.id),
    })),
  };
}

export async function syncProjects(input: unknown) {
  const args = SyncProjectsInputSchema.parse(input);
  const projectsIndex = await loadProjectsIndex();
  const repositories = selectProjects(
    projectsIndex.projects.filter((project) => project.enabled),
    args.projectIds,
  );
  const result = await syncRepositories(repositories);
  const runtime = await getRepositoriesRuntimeState(repositories);
  const runtimeById = new Map(runtime.map((state) => [state.projectId, state]));
  return {
    projectCount: result.projects.length,
    projects: result.projects.map((project) => ({
      id: project.id,
      name: project.name,
      branch: project.branch,
      path: project.path,
      runtime: runtimeById.get(project.id),
    })),
    runtime,
    errors: result.errors,
  };
}

export async function collectGitLogs(input: unknown) {
  const args = CollectGitLogsInputSchema.parse(input);
  const config = await loadConfig();
  const projectsIndex = await loadProjectsIndex();
  const repositories = selectProjects(
    projectsIndex.projects.filter((project) => project.enabled),
    args.projectIds,
  );
  const syncResult = await syncRepositories(repositories);
  const period = { start: args.since, end: args.until };
  const collectResult = await collectCommits({
    projects: syncResult.projects,
    period,
    authorOverrides: args.author,
    identities: config.identities,
  });
  collectResult.errors.unshift(...syncResult.errors);
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

function selectProjects<T extends { id: string; name: string }>(
  projects: T[],
  projectIds: string[],
): T[] {
  if (projectIds.length === 0) return projects;
  const selected = new Set(projectIds);
  const matches = projects.filter(
    (project) => selected.has(project.id) || selected.has(project.name),
  );
  const matchedIds = new Set(matches.flatMap((project) => [project.id, project.name]));
  const unknown = projectIds.filter((projectId) => !matchedIds.has(projectId));
  if (unknown.length > 0) {
    throw new Error(`Unknown or disabled projects: ${unknown.join(", ")}`);
  }
  return matches;
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
