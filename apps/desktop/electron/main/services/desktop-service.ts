import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  ConfigNotFoundError,
  ProjectsIndexNotFoundError,
  createDefaultConfig,
  getDefaultRepositoryPath,
  getRepositoriesRuntimeState,
  getGlobalGitIdentity,
  getConfigFilePath,
  getRepositoryId,
  getRepositoryName,
  getOutputRoot,
  getProjectsFilePath,
  initConfig,
  importRepositoryProjects,
  indexReportFiles,
  inspectRemoteRepository,
  loadConfig,
  loadConfigSnapshot,
  loadProjectsIndex,
  loadProjectsIndexSnapshot,
  removeRepositoryProject,
  readSummaryTemplate,
  renderSummaryTemplate,
  resetSummaryTemplate,
  saveRepositoryProject,
  saveSummaryTemplate,
  scanRepositoryFolder,
  setRepositoryEnabled,
  syncRepositories,
  writeConfigIfRevision,
  writeProjectsIndexIfRevision,
  validateSummaryTemplate,
} from "@weekly-git-report/core";
import { ConfigSchema, DEFAULT_CONFIG, RepositoryProjectSchema } from "@weekly-git-report/shared";
import type {
  Config,
  Period,
  ReportCadence,
  RepositoryFolderScanResult,
  RepositoryProject,
  RepositoryRuntimeState,
} from "@weekly-git-report/shared";

import type {
  ConfigInitializationDefaults,
  ConfigState,
  DesktopOverview,
  DiagnosticCheck,
  ImportRepositoriesRequest,
  ImportRepositoriesResult,
  ProjectsState,
  RemoteRepositoryDetails,
  ReportDocument,
  ReportFile,
  RepositorySyncResult,
  SaveRepositoryRequest,
  SummaryTemplatePreviewRequest,
  SummaryTemplateResetRequest,
  SummaryTemplateSaveRequest,
} from "../../../shared/ipc.js";

const execFileAsync = promisify(execFile);

export async function getDesktopOverview(): Promise<DesktopOverview> {
  const config = await loadOptionalConfig();
  let workspaceError: string | undefined;
  if (config) {
    try {
      await ensureDesktopWorkspace(config);
    } catch (error) {
      workspaceError = getErrorMessage(error);
    }
  }
  const [projects, diagnostics] = await Promise.all([loadOptionalProjects(), getDiagnostics()]);
  if (workspaceError) {
    diagnostics.unshift({
      id: "workspace",
      label: "工作区初始化",
      status: "error",
      message: workspaceError,
    });
  }
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

export async function getConfigState(): Promise<ConfigState> {
  try {
    const snapshot = await loadConfigSnapshot();
    try {
      await ensureDesktopWorkspace(snapshot.config);
      return { config: snapshot.config, revision: snapshot.revision };
    } catch (error) {
      return {
        config: snapshot.config,
        revision: snapshot.revision,
        workspaceError: getErrorMessage(error),
      };
    }
  } catch (error) {
    if (error instanceof ConfigNotFoundError) return { config: null, revision: null };
    throw error;
  }
}

export async function getConfigInitializationDefaults(): Promise<ConfigInitializationDefaults> {
  const detectedIdentity = await getGlobalGitIdentity();
  const config = createDefaultConfig();
  return {
    config: {
      ...config,
      identities: detectedIdentity ? [detectedIdentity] : [],
    },
    detectedIdentity,
  };
}

export async function initializeDesktopConfig(input: Config): Promise<ConfigState> {
  const config = ConfigSchema.parse({
    ...input,
    repositoryCacheRoot: DEFAULT_CONFIG.repositoryCacheRoot,
  });
  await prepareDesktopWorkspace(config);
  const snapshot = await writeConfigIfRevision(config, null);
  return { config: snapshot.config, revision: snapshot.revision };
}

export async function ensureDesktopWorkspace(config: Config): Promise<void> {
  await prepareDesktopWorkspace(config);
}

async function prepareDesktopWorkspace(config: Config): Promise<void> {
  await initConfig(config, { writeConfig: false });
  try {
    await loadProjectsIndexSnapshot();
  } catch (error) {
    if (!(error instanceof ProjectsIndexNotFoundError)) throw error;
    try {
      await writeProjectsIndexIfRevision({ projects: [] }, null);
    } catch (writeError) {
      try {
        await loadProjectsIndexSnapshot();
      } catch {
        throw writeError;
      }
    }
  }
}

export async function saveDesktopConfig(
  input: Config,
  expectedRevision: string,
): Promise<ConfigState> {
  const current = await loadConfigSnapshot();
  const config = ConfigSchema.parse({
    ...input,
    repositoryCacheRoot: current.config.repositoryCacheRoot,
  });
  await prepareDesktopWorkspace(config);
  const snapshot = await writeConfigIfRevision(config, expectedRevision);
  return { config: snapshot.config, revision: snapshot.revision };
}

export async function getDesktopSummaryTemplate(cadence: ReportCadence, period?: Period) {
  return readSummaryTemplate({ cadence, ...(period ? { period } : {}) });
}

export function previewDesktopSummaryTemplate(request: SummaryTemplatePreviewRequest): string {
  const content = validateSummaryTemplate(request.content);
  return renderSummaryTemplate(content, request.period, request.cadence);
}

export async function saveDesktopSummaryTemplate(request: SummaryTemplateSaveRequest) {
  return saveSummaryTemplate({
    content: request.content,
    cadence: request.cadence,
    expectedRevision: request.expectedRevision,
    ...(request.period ? { period: request.period } : {}),
  });
}

export async function resetDesktopSummaryTemplate(request: SummaryTemplateResetRequest) {
  return resetSummaryTemplate({
    cadence: request.cadence,
    expectedRevision: request.expectedRevision,
    ...(request.period ? { period: request.period } : {}),
  });
}

export async function loadOptionalProjects(): Promise<RepositoryProject[]> {
  try {
    return (await loadProjectsIndex()).projects;
  } catch (error) {
    if (error instanceof ProjectsIndexNotFoundError) return [];
    throw error;
  }
}

export async function getProjectsState(): Promise<ProjectsState> {
  try {
    const snapshot = await loadProjectsIndexSnapshot();
    return { projects: snapshot.index.projects, revision: snapshot.revision };
  } catch (error) {
    if (error instanceof ProjectsIndexNotFoundError) return { projects: [], revision: null };
    throw error;
  }
}

export async function getProjectsRuntimeState(): Promise<RepositoryRuntimeState[]> {
  return getRepositoriesRuntimeState(await loadOptionalProjects());
}

export async function scanDesktopRepositoryFolder(
  folder: string,
): Promise<RepositoryFolderScanResult> {
  return scanRepositoryFolder(folder);
}

export async function inspectRepository(url: string): Promise<RemoteRepositoryDetails> {
  const config = await loadConfig();
  const remote = await inspectRemoteRepository(url, { timeoutMs: 30_000 });
  if (remote.branches.length === 0) throw new Error("远程仓库没有可用分支。");
  return {
    ...remote,
    suggestedId: getRepositoryId(url),
    suggestedName: getRepositoryName(url),
    suggestedLocalPath: getDefaultRepositoryPath(config, url),
  };
}

export async function importDesktopRepositories(
  request: ImportRepositoriesRequest,
): Promise<ImportRepositoriesResult> {
  const result = await importRepositoryProjects({
    projects: request.projects,
    expectedRevision: request.expectedRevision,
  });
  return {
    state: { projects: result.snapshot.index.projects, revision: result.snapshot.revision },
    added: result.added.map((project) => project.id),
    errors: result.errors,
  };
}

export async function saveDesktopRepository(
  request: SaveRepositoryRequest,
): Promise<ProjectsState> {
  const project = RepositoryProjectSchema.parse(request.project);
  const snapshot = await saveRepositoryProject({
    project,
    currentId: request.currentId,
    expectedRevision: request.expectedRevision,
  });
  return { projects: snapshot.index.projects, revision: snapshot.revision };
}

export async function setDesktopRepositoryEnabled(
  id: string,
  enabled: boolean,
  expectedRevision: string,
): Promise<ProjectsState> {
  const snapshot = await setRepositoryEnabled(id, enabled, expectedRevision);
  return { projects: snapshot.index.projects, revision: snapshot.revision };
}

export async function syncDesktopRepositories(ids?: string[]): Promise<RepositorySyncResult> {
  const projects = (await loadProjectsIndex()).projects;
  const selected = ids?.length
    ? projects.filter((project) => ids.includes(project.id))
    : projects.filter((project) => project.enabled);
  if (selected.length === 0) throw new Error("没有可同步的仓库。");
  const result = await syncRepositories(selected);
  return {
    synced: result.projects.map((project) => project.id),
    errors: result.errors,
    runtime: await getRepositoriesRuntimeState(selected),
  };
}

export async function removeDesktopRepository(
  id: string,
  deleteCache: boolean,
  expectedRevision: string,
): Promise<ProjectsState> {
  const config = await loadConfig();
  const snapshot = await removeRepositoryProject({
    id,
    deleteCache,
    expectedRevision,
    config,
  });
  return { projects: snapshot.index.projects, revision: snapshot.revision };
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
  return indexReportFiles(outputRoot);
}

export async function readReportFile(id: string): Promise<ReportDocument> {
  const config = await loadOptionalConfig();
  if (!config) throw new Error("请先完成全局配置。");

  const outputRoot = getOutputRoot(config.outputRoot);
  const report = (await indexReportFiles(outputRoot)).find((item) => item.id === id);
  if (!report) throw new Error(`报告不存在或不属于规范报告目录：${id}`);
  const absolutePath = resolveReportPath(outputRoot, id);
  return {
    ...report,
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
