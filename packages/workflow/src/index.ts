import { randomUUID } from "node:crypto";
import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

import {
  collectCommits,
  createSummaryMetadata,
  getPeriodOutputDir,
  getSummaryMetadataFilePath,
  getRepositoriesRuntimeState,
  hashFile,
  inspectSummaryMetadata,
  loadConfig,
  loadProjectsIndex,
  readSummaryTemplate,
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
  MANIFEST_FILE_NAME,
  ReadWeekRawInputSchema,
  SaveSummaryInputSchema,
  SaveWeekSummaryInputSchema,
  SyncProjectsInputSchema,
} from "@weekly-git-report/shared";

import { getSafeSummaryFile, readWeekIndexFile, readWeekProjectFiles } from "./path-security.js";

export * from "./run-store.js";
export * from "./ai.js";
export * from "./feishu.js";
export * from "./report-run.js";
export * from "./scheduler.js";

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
  return saveSummary({ ...args, reportType: "weekly", force: false });
}

export async function saveSummary(input: unknown) {
  const args = SaveSummaryInputSchema.parse(input);
  const config = await loadConfig();
  validateSummaryPeriod(args.reportType, args);
  const reportId = args.provenance?.reportId ?? args.reportId ?? randomUUID();
  if (args.reportId && args.provenance && args.reportId !== args.provenance.reportId) {
    throw new Error("Summary reportId does not match its provenance.");
  }
  const summaryFile = getSafeSummaryFile(config.outputRoot, args, args.reportType, reportId);
  const metadataFile = getSummaryMetadataFilePath(summaryFile);
  const content = args.content.endsWith("\n") ? args.content : `${args.content}\n`;
  const rawManifestFile = path.join(
    getPeriodOutputDir(config.outputRoot, args),
    MANIFEST_FILE_NAME,
  );
  const rawManifestHash = await hashFile(rawManifestFile);
  const template = await readSummaryTemplate({
    reportType: args.reportType,
    period: args,
    reportTitle: args.title,
  });
  const provenance = args.provenance ?? {
    reportId,
    runId: randomUUID(),
    generator: "external-agent" as const,
    templateRevision: template.template.revision,
    rawManifestHash,
  };
  if (provenance.rawManifestHash !== rawManifestHash) {
    throw new Error("Raw manifest changed since this summary was prepared.");
  }
  const replaced = await fileExists(summaryFile);
  const backupFiles: string[] = [];

  if (replaced) {
    const current = await inspectSummaryMetadata(summaryFile, args, undefined, {
      reportType: args.reportType,
      ...(args.reportType === "custom" ? { reportId } : {}),
    });
    if (current.status === "invalid" && !args.force) {
      throw new Error("Existing summary metadata is invalid. Pass --force to replace it.");
    }
    backupFiles.push(...(await backupSummaryFiles(summaryFile, metadataFile)));
  }

  const metadata = createSummaryMetadata(args.reportType, args, content, provenance, args.title);

  await mkdir(path.dirname(summaryFile), { recursive: true });
  await writeTextAtomic(summaryFile, content);
  await writeJsonAtomic(metadataFile, metadata);

  return {
    summaryFile,
    metadataFile,
    reportId,
    reportType: args.reportType,
    ...(args.title ? { title: args.title } : {}),
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
