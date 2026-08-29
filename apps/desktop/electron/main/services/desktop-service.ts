import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  ConfigNotFoundError,
  ProjectsIndexNotFoundError,
  clearAiConfig,
  clearFeishuConfig,
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
  indexTrashedReportFiles,
  getSummaryMetadataFilePath,
  inspectRemoteRepository,
  loadConfig,
  loadConfigSnapshot,
  loadOptionalAiConfig,
  loadOptionalFeishuConfig,
  loadProjectsIndex,
  loadProjectsIndexSnapshot,
  loadTasksSnapshot,
  removeRepositoryProject,
  readSummaryTemplate,
  renderSummaryTemplate,
  resetSummaryTemplate,
  saveRepositoryProject,
  saveAiConfig,
  saveFeishuConfig,
  saveTasksIfRevision,
  saveSummaryTemplate,
  scanRepositoryFolder,
  setRepositoryEnabled,
  syncRepositories,
  writeConfigIfRevision,
  writeProjectsIndexIfRevision,
  validateSummaryTemplate,
} from "@weekly-git-report/core";
import {
  AiConfigSchema,
  ConfigSchema,
  DEFAULT_CONFIG,
  FeishuConfigSchema,
  RepositoryProjectSchema,
  TasksDocumentSchema,
  SUMMARY_DIR_NAME,
  TRASH_DIR_NAME,
  TRASH_MANIFEST_FILE_NAME,
} from "@weekly-git-report/shared";
import type {
  Config,
  Period,
  ReportType,
  ReportRun,
  ReportTask,
  RepositoryFolderScanResult,
  RepositoryProject,
  RepositoryRuntimeState,
} from "@weekly-git-report/shared";
import {
  DEFAULT_AI_MODELS,
  approveReportRun,
  cancelReportRun,
  generateBuiltInRun,
  getReportRun,
  getReportRunCounts,
  listReportRuns,
  maintainReportRuns,
  prepareReportRun,
  publishSummaryToFeishu,
  registerTaskSchedule,
  resolveCurrentPeriod,
  resolveScheduledTaskPeriod,
  retryReportRun,
  testAiConfiguration,
  testFeishuConfiguration,
  unregisterTaskSchedule,
} from "@weekly-git-report/workflow";

import type {
  ConfigInitializationDefaults,
  ConfigState,
  DesktopOverview,
  DiagnosticCheck,
  GenerateReportRequest,
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
  SecretConfigurationStatus,
  TasksState,
} from "../../../shared/ipc.js";

const execFileAsync = promisify(execFile);

export async function getDesktopOverview(): Promise<DesktopOverview> {
  await maintainReportRuns();
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
  const tasks = await loadTasksSnapshot();
  const reports = config ? await listReportFiles(config) : [];

  return {
    initialized: config !== null,
    config,
    projectCount: projects.length,
    enabledProjectCount: projects.filter((project) => project.enabled).length,
    reportCount: reports.length,
    enabledTaskCount: tasks.document.tasks.filter((task) => task.enabled).length,
    runCounts: getReportRunCounts(),
    diagnostics,
  };
}

export async function getDesktopAiStatus(): Promise<SecretConfigurationStatus> {
  const config = await loadOptionalAiConfig();
  return config
    ? {
        configured: true,
        provider: config.provider,
        model: DEFAULT_AI_MODELS[config.provider],
        ...(config.testedAt ? { testedAt: config.testedAt } : {}),
      }
    : { configured: false };
}

export async function configureDesktopAi(provider: "openai" | "deepseek", apiKey: string) {
  await saveAiConfig(
    AiConfigSchema.parse({
      version: 1,
      provider,
      apiKey,
      dataSharingAcceptedAt: new Date().toISOString(),
    }),
  );
  return getDesktopAiStatus();
}

export async function testDesktopAi() {
  const config = await loadOptionalAiConfig();
  if (!config) throw new Error("请先配置 AI。 ");
  await testAiConfiguration(config);
  await saveAiConfig({ ...config, testedAt: new Date().toISOString() });
  return getDesktopAiStatus();
}

export async function clearDesktopAi() {
  await clearAiConfig();
  return getDesktopAiStatus();
}

export async function getDesktopFeishuStatus(): Promise<SecretConfigurationStatus> {
  const config = await loadOptionalFeishuConfig();
  return config
    ? {
        configured: true,
        signingEnabled: Boolean(config.signingSecret),
        ...(config.testedAt ? { testedAt: config.testedAt } : {}),
      }
    : { configured: false };
}

export async function configureDesktopFeishu(webhookUrl: string, signingSecret?: string) {
  await saveFeishuConfig(
    FeishuConfigSchema.parse({
      version: 1,
      webhookUrl,
      ...(signingSecret ? { signingSecret } : {}),
    }),
  );
  return getDesktopFeishuStatus();
}

export async function testDesktopFeishu() {
  const config = await loadOptionalFeishuConfig();
  if (!config) throw new Error("请先配置飞书机器人。 ");
  await testFeishuConfiguration(config);
  await saveFeishuConfig({ ...config, testedAt: new Date().toISOString() });
  return getDesktopFeishuStatus();
}

export async function clearDesktopFeishu() {
  await clearFeishuConfig();
  return getDesktopFeishuStatus();
}

export async function getDesktopTasksState(): Promise<TasksState> {
  const snapshot = await loadTasksSnapshot();
  return { document: snapshot.document, revision: snapshot.revision };
}

export async function saveDesktopTasks(
  document: unknown,
  expectedRevision: string | null,
): Promise<TasksState> {
  const current = await loadTasksSnapshot();
  const parsed = TasksDocumentSchema.parse(document);
  for (const task of parsed.tasks.filter((item) => item.enabled)) {
    await assertTaskAutomationReady(task);
  }
  const snapshot = await saveTasksIfRevision(parsed, expectedRevision);
  try {
    await syncDesktopTaskSchedules(current.document.tasks, parsed.tasks);
  } catch (error) {
    try {
      await saveTasksIfRevision(current.document, snapshot.revision);
      await syncDesktopTaskSchedules(parsed.tasks, current.document.tasks);
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], "任务调度失败，且自动回滚未能完整恢复。", {
        cause: rollbackError,
      });
    }
    throw error;
  }
  return { document: snapshot.document, revision: snapshot.revision };
}

async function syncDesktopTaskSchedules(
  previousTasks: ReportTask[],
  nextTasks: ReportTask[],
): Promise<void> {
  const nextIds = new Set(nextTasks.map((task) => task.id));
  for (const previous of previousTasks) {
    if (!nextIds.has(previous.id) || !nextTasks.find((task) => task.id === previous.id)?.enabled) {
      await unregisterTaskSchedule(previous.id);
    }
  }
  for (const task of nextTasks.filter((item) => item.enabled)) {
    await registerTaskSchedule(task, desktopSchedulerCommand(task.id));
  }
}

function desktopSchedulerCommand(taskId: string) {
  const developmentEntry =
    process.defaultApp && process.argv[1] ? path.resolve(process.argv[1]) : null;
  return {
    executable: process.execPath,
    args: [...(developmentEntry ? [developmentEntry] : []), "--run-task", taskId],
  };
}

export async function runDesktopTask(
  id: string,
  trigger: "manual" | "scheduled" = "manual",
): Promise<ReportRun> {
  const task = (await loadTasksSnapshot()).document.tasks.find((item) => item.id === id);
  if (!task) throw new Error(`任务不存在：${id}`);
  if (trigger === "scheduled" && !task.enabled) throw new Error("定时任务已停用。 ");
  await assertTaskAutomationReady(task);
  const prepared = await prepareReportRun({
    reportType: task.cadence,
    period:
      trigger === "manual"
        ? resolveCurrentPeriod(task.cadence)
        : resolveScheduledTaskPeriod(task.cadence, new Date(), task.schedule.includeWeekends),
    generator: "builtin-ai",
    trigger,
    task,
  });
  return generateBuiltInRun(prepared.run.id, {
    autoSave: task.mode === "autoPublish",
    publish: task.mode === "autoPublish" && task.publishToFeishu,
  });
}

export function listDesktopRuns(limit?: number): ReportRun[] {
  return listReportRuns(limit);
}

export function getDesktopRun(id: string): ReportRun {
  return getReportRun(id);
}

export async function readDesktopRunDraft(id: string): Promise<string> {
  const run = getReportRun(id);
  if (!run.draftPath) throw new Error("该运行没有可审核草稿。 ");
  return readFile(run.draftPath, "utf8");
}

export async function generateDesktopReport(
  request: GenerateReportRequest,
  onTextDelta: (runId: string, delta: string) => void,
): Promise<ReportRun> {
  const prepared = await prepareReportRun({
    reportType: request.reportType,
    period: request.period,
    ...(request.reportId ? { reportId: request.reportId } : {}),
    ...(request.title ? { title: request.title } : {}),
    generator: "builtin-ai",
    trigger: "manual",
    projectIds: request.projectIds,
    userContext: request.userContext,
    onRunCreated: (runId) => onTextDelta(runId, ""),
  });
  return generateBuiltInRun(prepared.run.id, {
    onTextDelta: (delta) => onTextDelta(prepared.run.id, delta),
  });
}

export async function approveDesktopRun(
  id: string,
  content: string,
  publish = false,
  force = false,
) {
  return approveReportRun(id, content, { publish, force });
}

export function cancelDesktopRun(id: string) {
  return cancelReportRun(id);
}

export function retryDesktopRun(id: string) {
  return retryReportRun(id);
}

export function cancelActiveManualRuns(): void {
  for (const run of listReportRuns(200)) {
    if (run.trigger === "manual" && ["queued", "collecting", "generating"].includes(run.status)) {
      cancelReportRun(run.id);
    }
  }
}

export async function publishDesktopReport(id: string): Promise<void> {
  const config = await loadOptionalFeishuConfig();
  if (!config?.testedAt) throw new Error("飞书配置尚未测试成功。 ");
  await publishSummaryToFeishu(config, await getReportAbsolutePath(id));
}

async function assertTaskAutomationReady(task: ReportTask): Promise<void> {
  const ai = await loadOptionalAiConfig();
  if (!ai?.testedAt) throw new Error("AI 配置必须先测试成功。 ");
  if (task.mode === "autoPublish" && task.publishToFeishu) {
    const feishu = await loadOptionalFeishuConfig();
    if (!feishu?.testedAt) throw new Error("飞书配置必须先测试成功。 ");
  }
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

export async function getDesktopSummaryTemplate(
  reportType: ReportType,
  period?: Period,
  reportTitle?: string,
) {
  return readSummaryTemplate({
    reportType,
    ...(period ? { period } : {}),
    ...(reportTitle ? { reportTitle } : {}),
  });
}

export function previewDesktopSummaryTemplate(request: SummaryTemplatePreviewRequest): string {
  const content = validateSummaryTemplate(request.content, request.reportType);
  return renderSummaryTemplate(content, request.period, request.reportType, request.reportTitle);
}

export async function saveDesktopSummaryTemplate(request: SummaryTemplateSaveRequest) {
  return saveSummaryTemplate({
    content: request.content,
    reportType: request.reportType,
    expectedRevision: request.expectedRevision,
    ...(request.period ? { period: request.period } : {}),
  });
}

export async function resetDesktopSummaryTemplate(request: SummaryTemplateResetRequest) {
  return resetSummaryTemplate({
    reportType: request.reportType,
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

export async function listReportFiles(config?: Config, trashed = false): Promise<ReportFile[]> {
  const loadedConfig = config ?? (await loadOptionalConfig());
  if (!loadedConfig) return [];

  const outputRoot = getOutputRoot(loadedConfig.outputRoot);
  return trashed ? indexTrashedReportFiles(outputRoot) : indexReportFiles(outputRoot);
}

export async function readReportFile(id: string): Promise<ReportDocument> {
  const config = await loadOptionalConfig();
  if (!config) throw new Error("请先完成全局配置。");

  const outputRoot = getOutputRoot(config.outputRoot);
  const report = [
    ...(await indexReportFiles(outputRoot)),
    ...(await indexTrashedReportFiles(outputRoot)),
  ].find((item) => item.id === id);
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

export async function trashDesktopReport(id: string): Promise<void> {
  const config = await loadConfig();
  const outputRoot = getOutputRoot(config.outputRoot);
  const report = (await indexReportFiles(outputRoot)).find((item) => item.id === id);
  if (!report || report.kind !== "summary") throw new Error("只能将 Summary 报告移入回收站。");

  const summaryFile = resolveReportPath(outputRoot, report.id);
  const metadataFile = getSummaryMetadataFilePath(summaryFile);
  const trashDirectory = path.join(
    outputRoot,
    SUMMARY_DIR_NAME,
    TRASH_DIR_NAME,
    `${Date.now()}-${randomUUID()}`,
  );
  await mkdir(path.dirname(trashDirectory), { recursive: true });
  await mkdir(trashDirectory, { recursive: false });
  const markdownName = path.basename(summaryFile);
  const metadataName = path.basename(metadataFile);
  const trashedSummaryFile = path.join(trashDirectory, markdownName);
  const trashedMetadataFile = path.join(trashDirectory, metadataName);
  const hasMetadata = await fileExists(metadataFile);
  try {
    await rename(summaryFile, trashedSummaryFile);
    if (hasMetadata) await rename(metadataFile, trashedMetadataFile);
    await writeFile(
      path.join(trashDirectory, TRASH_MANIFEST_FILE_NAME),
      `${JSON.stringify(
        {
          version: 1,
          originalRelativePath: report.relativePath,
          markdownName,
          ...(hasMetadata ? { metadataName } : {}),
          trashedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  } catch (error) {
    if (await fileExists(trashedMetadataFile)) await rename(trashedMetadataFile, metadataFile);
    if (await fileExists(trashedSummaryFile)) await rename(trashedSummaryFile, summaryFile);
    await rm(trashDirectory, { recursive: true, force: true });
    throw error;
  }
}

export async function restoreDesktopReport(id: string): Promise<void> {
  const config = await loadConfig();
  const outputRoot = getOutputRoot(config.outputRoot);
  const report = (await indexTrashedReportFiles(outputRoot)).find((item) => item.id === id);
  if (!report?.trashed || !report.originalRelativePath) throw new Error("回收站报告不存在。");

  const trashedSummaryFile = resolveReportPath(outputRoot, report.id);
  const trashDirectory = path.dirname(trashedSummaryFile);
  const manifest = parseTrashManifest(
    JSON.parse(await readFile(path.join(trashDirectory, TRASH_MANIFEST_FILE_NAME), "utf8")),
  );
  if (manifest.originalRelativePath !== report.originalRelativePath) {
    throw new Error("回收站清单与报告索引不一致。");
  }
  const summaryFile = resolveRestoredSummaryPath(outputRoot, manifest.originalRelativePath);
  if (await fileExists(summaryFile)) throw new Error("原位置已存在同名报告，无法恢复。");
  const metadataFile = getSummaryMetadataFilePath(summaryFile);
  const trashedMetadataFile = manifest.metadataName
    ? path.join(trashDirectory, manifest.metadataName)
    : undefined;
  await mkdir(path.dirname(summaryFile), { recursive: true });
  try {
    await rename(trashedSummaryFile, summaryFile);
    if (trashedMetadataFile && (await fileExists(trashedMetadataFile))) {
      await rename(trashedMetadataFile, metadataFile);
    }
    await rm(trashDirectory, { recursive: true });
  } catch (error) {
    if ((await fileExists(metadataFile)) && trashedMetadataFile) {
      await rename(metadataFile, trashedMetadataFile);
    }
    if (await fileExists(summaryFile)) await rename(summaryFile, trashedSummaryFile);
    throw error;
  }
}

export async function deleteDesktopReportPermanently(id: string): Promise<void> {
  const config = await loadConfig();
  const outputRoot = getOutputRoot(config.outputRoot);
  const report = (await indexTrashedReportFiles(outputRoot)).find((item) => item.id === id);
  if (!report?.trashed) throw new Error("回收站报告不存在。");
  const summaryFile = resolveReportPath(outputRoot, report.id);
  const trashRoot = path.resolve(outputRoot, SUMMARY_DIR_NAME, TRASH_DIR_NAME);
  const trashDirectory = path.dirname(summaryFile);
  const relative = path.relative(trashRoot, trashDirectory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("拒绝删除回收站目录之外的文件。");
  }
  await rm(trashDirectory, { recursive: true });
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

function resolveRestoredSummaryPath(outputRoot: string, relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/");
  if (
    !normalized.startsWith(`${SUMMARY_DIR_NAME}/`) ||
    normalized.includes(`/${TRASH_DIR_NAME}/`)
  ) {
    throw new Error("回收站原始路径无效。");
  }
  return resolveReportPath(outputRoot, normalized);
}

function parseTrashManifest(value: unknown): {
  originalRelativePath: string;
  markdownName: string;
  metadataName?: string;
} {
  if (!value || typeof value !== "object") throw new Error("回收站清单无效。");
  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 ||
    typeof record.originalRelativePath !== "string" ||
    typeof record.markdownName !== "string" ||
    path.basename(record.markdownName) !== record.markdownName ||
    (record.metadataName !== undefined &&
      (typeof record.metadataName !== "string" ||
        path.basename(record.metadataName) !== record.metadataName))
  )
    throw new Error("回收站清单无效。");
  return {
    originalRelativePath: record.originalRelativePath,
    markdownName: record.markdownName,
    ...(typeof record.metadataName === "string" ? { metadataName: record.metadataName } : {}),
  };
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
