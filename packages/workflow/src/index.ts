import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

import {
  collectCommits,
  createSummaryMetadata,
  getSummaryMetadataFilePath,
  getRepositoriesRuntimeState,
  inspectSummaryMetadata,
  loadConfig,
  loadProjectsIndex,
  syncRepositories,
  validateSummaryPeriod,
  writeJsonAtomic,
  writeReport,
  writeTextAtomic,
} from "@weekly-git-report/core";
import {
  CollectGitLogsInputSchema,
  GetWeekIndexInputSchema,
  ListProjectsInputSchema,
  ReadWeekRawInputSchema,
  SaveSummaryInputSchema,
  SaveWeekSummaryInputSchema,
  SyncProjectsInputSchema,
} from "@weekly-git-report/shared";

import { getSafeSummaryFile, readWeekIndexFile, readWeekProjectFiles } from "./path-security.js";

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
  return saveSummary({ ...args, cadence: "weekly", force: false });
}

export async function saveSummary(input: unknown) {
  const args = SaveSummaryInputSchema.parse(input);
  const config = await loadConfig();
  validateSummaryPeriod(args.cadence, args);
  const summaryFile = getSafeSummaryFile(config.outputRoot, args);
  const metadataFile = getSummaryMetadataFilePath(summaryFile);
  const content = args.content.endsWith("\n") ? args.content : `${args.content}\n`;
  const replaced = await fileExists(summaryFile);
  const backupFiles: string[] = [];

  if (replaced) {
    const current = await inspectSummaryMetadata(summaryFile, args);
    if (current.status === "invalid" && !args.force) {
      throw new Error("Existing summary metadata is invalid. Pass --force to replace it.");
    }
    if (current.cadence && current.cadence !== args.cadence && !args.force) {
      throw new Error(
        `Existing summary is ${current.cadence}; pass --force to replace it with ${args.cadence}.`,
      );
    }
    backupFiles.push(...(await backupSummaryFiles(summaryFile, metadataFile)));
  }

  const metadata = createSummaryMetadata(args.cadence, args, content);

  await mkdir(path.dirname(summaryFile), { recursive: true });
  await writeTextAtomic(summaryFile, content);
  await writeJsonAtomic(metadataFile, metadata);

  return {
    summaryFile,
    metadataFile,
    cadence: args.cadence,
    bytes: Buffer.byteLength(content, "utf8"),
    replaced,
    backupFiles,
  };
}

async function backupSummaryFiles(summaryFile: string, metadataFile: string): Promise<string[]> {
  const historyDir = path.join(path.dirname(summaryFile), ".history");
  await mkdir(historyDir, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const baseName = path.basename(summaryFile, path.extname(summaryFile));
  const summaryBackup = path.join(historyDir, `${baseName}.${timestamp}.md`);
  await copyFile(summaryFile, summaryBackup);
  const backupFiles = [summaryBackup];
  if (await fileExists(metadataFile)) {
    const metadataBackup = path.join(historyDir, `${baseName}.${timestamp}.meta.json`);
    await copyFile(metadataFile, metadataBackup);
    backupFiles.push(metadataBackup);
  }
  return backupFiles;
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
