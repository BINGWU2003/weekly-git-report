import { execFile } from "node:child_process";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  ConfigNotFoundError,
  ProjectsIndexNotFoundError,
  getConfigFilePath,
  getOutputRoot,
  getProjectsFilePath,
  loadConfig,
  loadProjectsIndex,
} from "@weekly-git-report/core";
import type { Config, RepositoryProject } from "@weekly-git-report/shared";

import type {
  DesktopOverview,
  DiagnosticCheck,
  ReportDocument,
  ReportFile,
} from "../../../shared/ipc.js";

const execFileAsync = promisify(execFile);
const MAX_REPORT_FILES = 2_000;

export async function getDesktopOverview(): Promise<DesktopOverview> {
  const [config, projects, diagnostics] = await Promise.all([
    loadOptionalConfig(),
    loadOptionalProjects(),
    getDiagnostics(),
  ]);
  const reports = config ? await listReportFiles(config) : [];

  return {
    initialized: config !== null,
    config,
    projectCount: projects.length,
    enabledProjectCount: projects.filter((project) => project.enabled).length,
    reportCount: reports.length,
    diagnostics,
  };
}

export async function loadOptionalConfig(): Promise<Config | null> {
  try {
    return await loadConfig();
  } catch (error) {
    if (error instanceof ConfigNotFoundError) return null;
    throw error;
  }
}

export async function loadOptionalProjects(): Promise<RepositoryProject[]> {
  try {
    return (await loadProjectsIndex()).projects;
  } catch (error) {
    if (error instanceof ProjectsIndexNotFoundError) return [];
    throw error;
  }
}

export async function getDiagnostics(): Promise<DiagnosticCheck[]> {
  const [git, config, projects] = await Promise.all([
    checkGit(),
    checkJsonFile("config", "全局配置", getConfigFilePath(), loadOptionalConfig),
    checkJsonFile("projects", "仓库配置", getProjectsFilePath(), loadOptionalProjects),
  ]);
  const loadedConfig = await loadOptionalConfig();
  const output = await checkOutputRoot(loadedConfig);

  return [git, config, projects, output];
}

export async function listReportFiles(config?: Config): Promise<ReportFile[]> {
  const loadedConfig = config ?? (await loadOptionalConfig());
  if (!loadedConfig) return [];

  const outputRoot = getOutputRoot(loadedConfig.outputRoot);
  const files: ReportFile[] = [];
  await walkMarkdownFiles(outputRoot, outputRoot, files);
  return files.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
}

export async function readReportFile(id: string): Promise<ReportDocument> {
  const config = await loadOptionalConfig();
  if (!config) throw new Error("请先完成全局配置。");

  const outputRoot = getOutputRoot(config.outputRoot);
  const absolutePath = resolveReportPath(outputRoot, id);
  const fileStat = await stat(absolutePath);
  const relativePath = path.relative(outputRoot, absolutePath);
  return {
    id: relativePath.replaceAll("\\", "/"),
    name: path.basename(absolutePath),
    relativePath,
    kind: getReportKind(relativePath),
    modifiedAt: fileStat.mtime.toISOString(),
    size: fileStat.size,
    content: await readFile(absolutePath, "utf8"),
  };
}

export async function getReportAbsolutePath(id: string): Promise<string> {
  const config = await loadOptionalConfig();
  if (!config) throw new Error("请先完成全局配置。");
  return resolveReportPath(getOutputRoot(config.outputRoot), id);
}

async function checkGit(): Promise<DiagnosticCheck> {
  try {
    const { stdout } = await execFileAsync("git", ["--version"], { windowsHide: true });
    return { id: "git", label: "Git", status: "ok", message: stdout.trim() };
  } catch (error) {
    return { id: "git", label: "Git", status: "error", message: getErrorMessage(error) };
  }
}

async function checkJsonFile<T>(
  id: "config" | "projects",
  label: string,
  file: string,
  loader: () => Promise<T>,
): Promise<DiagnosticCheck> {
  try {
    await access(file);
    await loader();
    return { id, label, status: "ok", message: file };
  } catch (error) {
    const missing =
      error instanceof ConfigNotFoundError || error instanceof ProjectsIndexNotFoundError;
    return {
      id,
      label,
      status: missing ? "warning" : "error",
      message: missing ? `尚未创建：${file}` : getErrorMessage(error),
    };
  }
}

async function checkOutputRoot(config: Config | null): Promise<DiagnosticCheck> {
  if (!config) {
    return {
      id: "output",
      label: "报告目录",
      status: "warning",
      message: "完成全局配置后检查报告目录。",
    };
  }

  const outputRoot = getOutputRoot(config.outputRoot);
  try {
    await access(outputRoot);
    return { id: "output", label: "报告目录", status: "ok", message: outputRoot };
  } catch {
    return {
      id: "output",
      label: "报告目录",
      status: "warning",
      message: `目录尚未创建：${outputRoot}`,
    };
  }
}

async function walkMarkdownFiles(
  root: string,
  current: string,
  files: ReportFile[],
): Promise<void> {
  if (files.length >= MAX_REPORT_FILES) return;

  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (files.length >= MAX_REPORT_FILES) return;
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdownFiles(root, absolutePath, files);
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") continue;

    const relativePath = path.relative(root, absolutePath);
    const fileStat = await stat(absolutePath);
    files.push({
      id: relativePath.replaceAll("\\", "/"),
      name: entry.name,
      relativePath,
      kind: getReportKind(relativePath),
      modifiedAt: fileStat.mtime.toISOString(),
      size: fileStat.size,
    });
  }
}

function getReportKind(relativePath: string): ReportFile["kind"] {
  const firstSegment = relativePath.split(path.sep)[0]?.toLowerCase();
  if (firstSegment === "raw") return "raw";
  if (firstSegment === "summary") return "summary";
  if (firstSegment === "tasks") return "task";
  return "other";
}

function resolveReportPath(outputRoot: string, id: string): string {
  if (!id || path.extname(id).toLowerCase() !== ".md") {
    throw new Error("只能访问报告目录中的 Markdown 文件。");
  }
  const absolutePath = path.resolve(outputRoot, id);
  const relativePath = path.relative(outputRoot, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("拒绝访问报告目录之外的文件。");
  }
  return absolutePath;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
