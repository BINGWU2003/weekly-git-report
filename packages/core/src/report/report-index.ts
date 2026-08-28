import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  INDEX_FILE_NAME,
  MANIFEST_FILE_NAME,
  ManifestSchema,
  RAW_DIR_NAME,
  SUMMARY_DIR_NAME,
} from "@weekly-git-report/shared";
import type {
  IndexedReportFile,
  Manifest,
  ManifestProject,
  Period,
} from "@weekly-git-report/shared";

const TASKS_DIR_NAME = "tasks";
const MAX_REPORT_FILES = 2_000;
const PERIOD_PATTERN = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/;
const HISTORY_NAME_PATTERN = /\.\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.md$/i;

export class ReportIndexError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ReportIndexError";
  }
}

export async function indexReportFiles(outputRoot: string): Promise<IndexedReportFile[]> {
  const reports: IndexedReportFile[] = [];
  await indexRawReports(outputRoot, reports);
  await indexSummaryReports(outputRoot, reports);
  await indexTaskReports(outputRoot, reports);
  return reports.toSorted(compareReports);
}

async function indexRawReports(outputRoot: string, reports: IndexedReportFile[]): Promise<void> {
  const rawRoot = path.join(outputRoot, RAW_DIR_NAME);
  for (const year of await readDirectories(rawRoot)) {
    if (!/^\d{4}$/.test(year.name)) continue;
    for (const month of await readDirectories(path.join(rawRoot, year.name))) {
      if (!/^\d{2}$/.test(month.name)) continue;
      const monthPath = path.join(rawRoot, year.name, month.name);
      for (const periodEntry of await readDirectories(monthPath)) {
        const pathPeriod = parsePeriod(periodEntry.name);
        if (!pathPeriod) continue;
        const periodPath = path.join(monthPath, periodEntry.name);
        const manifest = await readRawManifest(periodPath);
        assertManifestPeriod(periodPath, pathPeriod, manifest.period);
        await indexRawPeriod(outputRoot, periodPath, manifest, reports);
      }
    }
  }
}

async function indexRawPeriod(
  outputRoot: string,
  periodPath: string,
  manifest: Manifest,
  reports: IndexedReportFile[],
): Promise<void> {
  const projectsByFile = new Map(
    manifest.projects.map((project) => [normalizeManifestFile(project.file), project]),
  );

  const indexPath = path.join(periodPath, INDEX_FILE_NAME);
  await assertFileExists(indexPath, `Raw 周期缺少 ${INDEX_FILE_NAME}`);
  await appendReport(reports, outputRoot, indexPath, {
    kind: "raw",
    role: "raw-index",
    title: "周期索引",
    period: manifest.period,
    generatedAt: manifest.generatedAt,
  });

  for (const project of manifest.projects) {
    const projectFile = normalizeManifestFile(project.file);
    const projectPath = path.resolve(periodPath, projectFile);
    assertInsideDirectory(periodPath, projectPath, `Manifest 项目文件路径越界：${project.file}`);
    await assertFileExists(projectPath, `Manifest 引用的仓库报告不存在：${project.file}`);
    await appendReport(reports, outputRoot, projectPath, {
      kind: "raw",
      role: "raw-project",
      title: project.name,
      period: manifest.period,
      generatedAt: manifest.generatedAt,
      projectId: project.id,
      projectName: project.name,
    });
  }

  const referencedFiles = new Set([INDEX_FILE_NAME, ...projectsByFile.keys()]);
  for (const entry of await readFiles(periodPath)) {
    if (path.extname(entry.name).toLowerCase() !== ".md" || referencedFiles.has(entry.name)) {
      continue;
    }
    await appendReport(reports, outputRoot, path.join(periodPath, entry.name), {
      kind: "raw",
      role: "raw-project",
      title: path.basename(entry.name, path.extname(entry.name)),
      period: manifest.period,
      generatedAt: manifest.generatedAt,
    });
  }

  const historyPath = path.join(periodPath, ".history");
  for (const entry of await readFiles(historyPath)) {
    if (path.extname(entry.name).toLowerCase() !== ".md") continue;
    const project = findHistoryProject(entry.name, manifest.projects);
    const projectName = project?.name ?? historyBaseName(entry.name);
    await appendReport(reports, outputRoot, path.join(historyPath, entry.name), {
      kind: "raw",
      role: "raw-history",
      title: `${projectName} · 历史版本`,
      period: manifest.period,
      generatedAt: null,
      ...(project ? { projectId: project.id, projectName: project.name } : {}),
    });
  }
}

async function indexSummaryReports(
  outputRoot: string,
  reports: IndexedReportFile[],
): Promise<void> {
  const summaryRoot = path.join(outputRoot, SUMMARY_DIR_NAME);
  for (const year of await readDirectories(summaryRoot)) {
    if (!/^\d{4}$/.test(year.name)) continue;
    for (const month of await readDirectories(path.join(summaryRoot, year.name))) {
      if (!/^\d{2}$/.test(month.name)) continue;
      const monthPath = path.join(summaryRoot, year.name, month.name);
      for (const entry of await readFiles(monthPath)) {
        if (path.extname(entry.name).toLowerCase() !== ".md") continue;
        const period = parsePeriod(path.basename(entry.name, path.extname(entry.name)));
        if (!period) continue;
        await appendReport(reports, outputRoot, path.join(monthPath, entry.name), {
          kind: "summary",
          role: "summary",
          title: "周期总结",
          period,
          generatedAt: null,
        });
      }
    }
  }
}

async function indexTaskReports(outputRoot: string, reports: IndexedReportFile[]): Promise<void> {
  const tasksRoot = path.join(outputRoot, TASKS_DIR_NAME);
  await walkTaskFiles(tasksRoot, async (file) => {
    const parsed = path.parse(file);
    await appendReport(reports, outputRoot, file, {
      kind: "task",
      role: "task",
      title: parsed.name,
      period: findPeriodInPath(path.relative(tasksRoot, file)),
      generatedAt: null,
    });
  });
}

async function walkTaskFiles(
  current: string,
  visit: (file: string) => Promise<void>,
): Promise<void> {
  for (const entry of await readEntries(current)) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".")) await walkTaskFiles(absolutePath, visit);
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") {
      await visit(absolutePath);
    }
  }
}

async function appendReport(
  reports: IndexedReportFile[],
  outputRoot: string,
  absolutePath: string,
  metadata: Pick<IndexedReportFile, "kind" | "role" | "title" | "period" | "generatedAt"> &
    Partial<Pick<IndexedReportFile, "projectId" | "projectName">>,
): Promise<void> {
  if (reports.length >= MAX_REPORT_FILES) {
    throw new ReportIndexError(`报告文件超过 ${MAX_REPORT_FILES} 个，请整理报告目录后重试。`);
  }
  const fileStat = await stat(absolutePath);
  const relativePath = toPosixPath(path.relative(outputRoot, absolutePath));
  reports.push({
    id: relativePath,
    name: path.basename(absolutePath),
    relativePath,
    modifiedAt: fileStat.mtime.toISOString(),
    size: fileStat.size,
    ...metadata,
  });
}

async function readRawManifest(periodPath: string): Promise<Manifest> {
  const manifestPath = path.join(periodPath, MANIFEST_FILE_NAME);
  try {
    return ManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
  } catch (error) {
    throw new ReportIndexError(`Raw 报告元数据无效：${manifestPath}`, { cause: error });
  }
}

function assertManifestPeriod(directory: string, expected: Period, actual: Period): void {
  if (expected.start !== actual.start || expected.end !== actual.end) {
    throw new ReportIndexError(
      `Raw 报告周期与目录不一致：${directory}（Manifest: ${actual.start} ~ ${actual.end}）`,
    );
  }
}

async function assertFileExists(file: string, message: string): Promise<void> {
  try {
    await access(file);
  } catch (error) {
    throw new ReportIndexError(`${message}：${file}`, { cause: error });
  }
}

function assertInsideDirectory(directory: string, file: string, message: string): void {
  const relativePath = path.relative(directory, file);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new ReportIndexError(message);
  }
}

function findHistoryProject(
  fileName: string,
  projects: ManifestProject[],
): ManifestProject | undefined {
  const currentName = fileName.replace(HISTORY_NAME_PATTERN, ".md");
  return projects.find(
    (project) => path.basename(normalizeManifestFile(project.file)) === currentName,
  );
}

function historyBaseName(fileName: string): string {
  return path.basename(fileName.replace(HISTORY_NAME_PATTERN, ""), ".md");
}

function normalizeManifestFile(file: string): string {
  return file.replace(/^\.\//, "").replaceAll("\\", "/");
}

function findPeriodInPath(relativePath: string): Period | null {
  for (const segment of toPosixPath(relativePath).split("/")) {
    const period = parsePeriod(path.basename(segment, path.extname(segment)));
    if (period) return period;
  }
  return null;
}

function parsePeriod(value: string): Period | null {
  const match = PERIOD_PATTERN.exec(value);
  return match?.[1] && match[2] ? { start: match[1], end: match[2] } : null;
}

async function readDirectories(directory: string) {
  return (await readEntries(directory)).filter((entry) => entry.isDirectory());
}

async function readFiles(directory: string) {
  return (await readEntries(directory)).filter((entry) => entry.isFile());
}

async function readEntries(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }
}

function compareReports(left: IndexedReportFile, right: IndexedReportFile): number {
  const leftDate = left.period?.end ?? left.modifiedAt;
  const rightDate = right.period?.end ?? right.modifiedAt;
  return rightDate.localeCompare(leftDate) || left.relativePath.localeCompare(right.relativePath);
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
