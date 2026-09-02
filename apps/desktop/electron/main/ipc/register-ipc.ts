import { dialog, ipcMain, shell } from "electron";
import { getOutputRoot, normalizeAbsolutePath } from "@weekly-git-report/core";
import {
  AiProviderSchema,
  ConfigSchema,
  PeriodSchema,
  ReportTypeSchema,
  ProjectsIndexSchema,
  RepositoryProjectSchema,
} from "@weekly-git-report/shared";

import { IPC_CHANNELS } from "../../../shared/ipc.js";
import {
  checkDesktopUpdate,
  downloadDesktopUpdate,
  getDesktopUpdateStatus,
  installDesktopUpdate,
  openDesktopReleasePage,
  openDesktopUpdateLogs,
} from "../services/update-service.js";
import {
  getDesktopOverview,
  completeDesktopOnboarding,
  approveDesktopRun,
  cancelDesktopRun,
  clearDesktopAi,
  clearDesktopFeishu,
  configureDesktopAi,
  configureDesktopFeishu,
  generateDesktopReport,
  getDesktopAiStatus,
  getDesktopFeishuStatus,
  revealDesktopAi,
  revealDesktopFeishu,
  getDesktopRun,
  getDesktopTasksState,
  getDesktopOnboardingState,
  getConfigInitializationDefaults,
  getConfigState,
  getDiagnostics,
  getProjectsState,
  getProjectsRuntimeState,
  getReportAbsolutePath,
  initializeDesktopConfig,
  getDesktopSummaryTemplate,
  inspectRepository,
  importDesktopRepositories,
  listReportFiles,
  listDesktopRuns,
  loadOptionalConfig,
  loadOptionalProjects,
  readReportFile,
  readDesktopRunDraft,
  previewDesktopSummaryTemplate,
  publishDesktopReport,
  publishDesktopRun,
  trashDesktopReport,
  restoreDesktopReport,
  deleteDesktopReportPermanently,
  removeDesktopRepository,
  saveDesktopConfig,
  resetDesktopSummaryTemplate,
  regenerateDesktopRun,
  retryDesktopRun,
  runDesktopTask,
  saveDesktopSummaryTemplate,
  saveDesktopRepository,
  saveDesktopTasks,
  scanDesktopRepositoryFolder,
  setDesktopRepositoryEnabled,
  skipDesktopOnboardingAi,
  syncDesktopRepositories,
  testDesktopAi,
  testDesktopFeishu,
  rememberDesktopOnboardingRun,
} from "../services/desktop-service.js";

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.overviewGet, () => getDesktopOverview());
  ipcMain.handle(IPC_CHANNELS.onboardingState, () => getDesktopOnboardingState());
  ipcMain.handle(IPC_CHANNELS.onboardingRememberRun, (_event, runId: unknown) => {
    if (runId !== null && typeof runId !== "string") throw new Error("Run id 无效。");
    return rememberDesktopOnboardingRun(runId);
  });
  ipcMain.handle(IPC_CHANNELS.onboardingComplete, (_event, runId: unknown) => {
    if (typeof runId !== "string") throw new Error("Run id 不能为空。");
    return completeDesktopOnboarding(runId);
  });
  ipcMain.handle(IPC_CHANNELS.onboardingSkipAi, () => skipDesktopOnboardingAi());
  ipcMain.handle(IPC_CHANNELS.configGet, () => loadOptionalConfig());
  ipcMain.handle(IPC_CHANNELS.configState, () => getConfigState());
  ipcMain.handle(IPC_CHANNELS.configDefaults, () => getConfigInitializationDefaults());
  ipcMain.handle(IPC_CHANNELS.configInitialize, (_event, input: unknown) =>
    initializeDesktopConfig(ConfigSchema.parse(input)),
  );
  ipcMain.handle(IPC_CHANNELS.configSave, (_event, input: unknown, expectedRevision: unknown) => {
    if (typeof expectedRevision !== "string") throw new Error("配置版本不能为空。");
    return saveDesktopConfig(ConfigSchema.parse(input), expectedRevision);
  });
  ipcMain.handle(
    IPC_CHANNELS.templatesRead,
    (_event, reportType: unknown, period: unknown, reportTitle: unknown) =>
      getDesktopSummaryTemplate(
        reportType === undefined ? "weekly" : ReportTypeSchema.parse(reportType),
        period === undefined ? undefined : PeriodSchema.parse(period),
        typeof reportTitle === "string" ? reportTitle : undefined,
      ),
  );
  ipcMain.handle(IPC_CHANNELS.templatesPreview, (_event, input: unknown) => {
    const request = parseTemplateContentRequest(input);
    return previewDesktopSummaryTemplate(request);
  });
  ipcMain.handle(IPC_CHANNELS.templatesSave, (_event, input: unknown) => {
    const request = parseTemplateRevisionRequest(input);
    if (!isRecord(input) || typeof input.content !== "string") {
      throw new Error("模板内容无效。");
    }
    return saveDesktopSummaryTemplate({ ...request, content: input.content });
  });
  ipcMain.handle(IPC_CHANNELS.templatesReset, (_event, input: unknown) => {
    const request = parseTemplateRevisionRequest(input);
    return resetDesktopSummaryTemplate(request);
  });
  ipcMain.handle(IPC_CHANNELS.projectsList, () => loadOptionalProjects());
  ipcMain.handle(IPC_CHANNELS.projectsState, () => getProjectsState());
  ipcMain.handle(IPC_CHANNELS.projectsRuntimeState, () => getProjectsRuntimeState());
  ipcMain.handle(IPC_CHANNELS.projectsScanFolder, (_event, folder: unknown) => {
    if (typeof folder !== "string" || !folder.trim()) throw new Error("扫描目录不能为空。");
    return scanDesktopRepositoryFolder(folder);
  });
  ipcMain.handle(IPC_CHANNELS.projectsInspect, (_event, url: unknown) => {
    if (typeof url !== "string") throw new Error("仓库地址不能为空。");
    return inspectRepository(url);
  });
  ipcMain.handle(IPC_CHANNELS.projectsSave, (_event, input: unknown) => {
    if (!isRecord(input) || typeof input.expectedRevision !== "string") {
      throw new Error("仓库配置版本不能为空。");
    }
    if (input.currentId !== undefined && typeof input.currentId !== "string") {
      throw new Error("当前仓库 ID 无效。");
    }
    return saveDesktopRepository({
      project: RepositoryProjectSchema.parse(input.project),
      expectedRevision: input.expectedRevision,
      ...(typeof input.currentId === "string" ? { currentId: input.currentId } : {}),
    });
  });
  ipcMain.handle(IPC_CHANNELS.projectsImport, (_event, input: unknown) => {
    if (!isRecord(input) || typeof input.expectedRevision !== "string") {
      throw new Error("仓库配置版本不能为空。");
    }
    const projects = ProjectsIndexSchema.parse({ projects: input.projects }).projects;
    return importDesktopRepositories({ projects, expectedRevision: input.expectedRevision });
  });
  ipcMain.handle(
    IPC_CHANNELS.projectsSetEnabled,
    (_event, id: unknown, enabled: unknown, expectedRevision: unknown) => {
      if (typeof id !== "string" || typeof enabled !== "boolean") {
        throw new Error("仓库启用状态无效。");
      }
      if (typeof expectedRevision !== "string") throw new Error("仓库配置版本不能为空。");
      return setDesktopRepositoryEnabled(id, enabled, expectedRevision);
    },
  );
  ipcMain.handle(IPC_CHANNELS.projectsSync, (_event, ids: unknown) => {
    if (ids !== undefined && !isStringArray(ids)) throw new Error("仓库 ID 列表无效。");
    return syncDesktopRepositories(ids);
  });
  ipcMain.handle(
    IPC_CHANNELS.projectsRemove,
    (_event, id: unknown, deleteCache: unknown, expectedRevision: unknown) => {
      if (typeof id !== "string" || typeof deleteCache !== "boolean") {
        throw new Error("删除仓库参数无效。");
      }
      if (typeof expectedRevision !== "string") throw new Error("仓库配置版本不能为空。");
      return removeDesktopRepository(id, deleteCache, expectedRevision);
    },
  );
  ipcMain.handle(IPC_CHANNELS.reportsList, (_event, trashed: unknown) => {
    if (trashed !== undefined && typeof trashed !== "boolean") {
      throw new Error("回收站筛选参数无效。");
    }
    return listReportFiles(undefined, trashed === true);
  });
  ipcMain.handle(IPC_CHANNELS.reportsRead, (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Report id is required.");
    return readReportFile(id);
  });
  ipcMain.handle(IPC_CHANNELS.reportsShowInFolder, async (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Report id is required.");
    shell.showItemInFolder(await getReportAbsolutePath(id));
  });
  ipcMain.handle(IPC_CHANNELS.reportsPublish, (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Report id is required.");
    return publishDesktopReport(id);
  });
  ipcMain.handle(IPC_CHANNELS.reportsTrash, (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Report id is required.");
    return trashDesktopReport(id);
  });
  ipcMain.handle(IPC_CHANNELS.reportsRestore, (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Report id is required.");
    return restoreDesktopReport(id);
  });
  ipcMain.handle(IPC_CHANNELS.reportsDeletePermanently, (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Report id is required.");
    return deleteDesktopReportPermanently(id);
  });
  ipcMain.handle(IPC_CHANNELS.aiStatus, () => getDesktopAiStatus());
  ipcMain.handle(IPC_CHANNELS.aiReveal, () => revealDesktopAi());
  ipcMain.handle(IPC_CHANNELS.aiConfigure, (_event, input: unknown) => {
    if (!isRecord(input) || typeof input.dataSharingAccepted !== "boolean") {
      throw new Error("AI 配置参数无效。");
    }
    if (input.apiKey !== undefined && typeof input.apiKey !== "string") {
      throw new Error("API Key 无效。");
    }
    if (typeof input.baseUrl !== "string" || typeof input.model !== "string") {
      throw new Error("AI Base URL 和模型不能为空。");
    }
    return configureDesktopAi({
      provider: AiProviderSchema.parse(input.provider),
      baseUrl: input.baseUrl,
      model: input.model,
      dataSharingAccepted: input.dataSharingAccepted,
      ...(typeof input.apiKey === "string" ? { apiKey: input.apiKey } : {}),
    });
  });
  ipcMain.handle(IPC_CHANNELS.aiTest, () => testDesktopAi());
  ipcMain.handle(IPC_CHANNELS.aiClear, () => clearDesktopAi());
  ipcMain.handle(IPC_CHANNELS.feishuStatus, () => getDesktopFeishuStatus());
  ipcMain.handle(IPC_CHANNELS.feishuReveal, (_event, field: unknown) => {
    if (field !== "webhookUrl" && field !== "signingSecret") {
      throw new Error("敏感字段无效。");
    }
    return revealDesktopFeishu(field);
  });
  ipcMain.handle(IPC_CHANNELS.feishuConfigure, (_event, input: unknown) => {
    if (!isRecord(input)) throw new Error("飞书配置参数无效。");
    if (input.webhookUrl !== undefined && typeof input.webhookUrl !== "string") {
      throw new Error("Webhook 无效。");
    }
    if (
      input.signingSecret !== undefined &&
      input.signingSecret !== null &&
      typeof input.signingSecret !== "string"
    ) {
      throw new Error("飞书签名密钥无效。");
    }
    return configureDesktopFeishu({
      ...(typeof input.webhookUrl === "string" ? { webhookUrl: input.webhookUrl } : {}),
      ...(typeof input.signingSecret === "string" || input.signingSecret === null
        ? { signingSecret: input.signingSecret }
        : {}),
    });
  });
  ipcMain.handle(IPC_CHANNELS.feishuTest, () => testDesktopFeishu());
  ipcMain.handle(IPC_CHANNELS.feishuClear, () => clearDesktopFeishu());
  ipcMain.handle(IPC_CHANNELS.tasksState, () => getDesktopTasksState());
  ipcMain.handle(IPC_CHANNELS.tasksSave, (_event, document: unknown, expectedRevision: unknown) => {
    if (expectedRevision !== null && typeof expectedRevision !== "string") {
      throw new Error("任务配置版本无效。");
    }
    return saveDesktopTasks(document, expectedRevision);
  });
  ipcMain.handle(IPC_CHANNELS.tasksRun, (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Task id is required.");
    return runDesktopTask(id);
  });
  ipcMain.handle(IPC_CHANNELS.runsList, (_event, limit: unknown) => {
    if (limit !== undefined && (typeof limit !== "number" || !Number.isInteger(limit))) {
      throw new Error("Run limit must be an integer.");
    }
    return listDesktopRuns(limit);
  });
  ipcMain.handle(IPC_CHANNELS.runsGet, (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Run id is required.");
    return getDesktopRun(id);
  });
  ipcMain.handle(IPC_CHANNELS.runsReadDraft, (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Run id is required.");
    return readDesktopRunDraft(id);
  });
  ipcMain.handle(IPC_CHANNELS.runsGenerate, (event, input: unknown) => {
    if (!isRecord(input)) throw new Error("生成参数无效。");
    const request = {
      reportType: ReportTypeSchema.parse(input.reportType),
      ...(input.templateType === undefined
        ? {}
        : { templateType: ReportTypeSchema.parse(input.templateType) }),
      period: PeriodSchema.parse(input.period),
      ...(typeof input.reportId === "string" ? { reportId: input.reportId } : {}),
      ...(typeof input.title === "string" ? { title: input.title } : {}),
      ...(isStringArray(input.projectIds) ? { projectIds: input.projectIds } : {}),
      ...(typeof input.userContext === "string" ? { userContext: input.userContext } : {}),
    };
    return generateDesktopReport(request, (runId, delta) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.runsGenerationDelta, runId, delta);
      }
    });
  });
  ipcMain.handle(
    IPC_CHANNELS.runsApprove,
    (_event, id: unknown, content: unknown, publish: unknown, force: unknown) => {
      if (typeof id !== "string" || typeof content !== "string") throw new Error("审核参数无效。");
      if (publish !== undefined && typeof publish !== "boolean") throw new Error("推送参数无效。");
      if (force !== undefined && typeof force !== "boolean") throw new Error("覆盖参数无效。");
      return approveDesktopRun(id, content, publish, force);
    },
  );
  ipcMain.handle(IPC_CHANNELS.runsCancel, (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Run id is required.");
    return cancelDesktopRun(id);
  });
  ipcMain.handle(IPC_CHANNELS.runsRetry, (_event, id: unknown, allowEmpty: unknown) => {
    if (typeof id !== "string") throw new Error("Run id is required.");
    if (allowEmpty !== undefined && typeof allowEmpty !== "boolean") {
      throw new Error("空周期重试参数无效。");
    }
    return retryDesktopRun(id, allowEmpty === true);
  });
  ipcMain.handle(IPC_CHANNELS.runsRegenerate, (event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Run id is required.");
    return regenerateDesktopRun(id, (runId, delta) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.runsGenerationDelta, runId, delta);
      }
    });
  });
  ipcMain.handle(IPC_CHANNELS.runsPublish, (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Run id is required.");
    return publishDesktopRun(id);
  });
  ipcMain.handle(IPC_CHANNELS.updatesStatus, () => getDesktopUpdateStatus());
  ipcMain.handle(IPC_CHANNELS.updatesCheck, () => checkDesktopUpdate(true));
  ipcMain.handle(IPC_CHANNELS.updatesDownload, () => downloadDesktopUpdate());
  ipcMain.handle(IPC_CHANNELS.updatesInstall, () => installDesktopUpdate());
  ipcMain.handle(IPC_CHANNELS.updatesOpenRelease, () => openDesktopReleasePage());
  ipcMain.handle(IPC_CHANNELS.updatesOpenLogs, () => openDesktopUpdateLogs());
  ipcMain.handle(IPC_CHANNELS.systemDiagnostics, () => getDiagnostics());
  ipcMain.handle(IPC_CHANNELS.systemOpenOutputRoot, async () => {
    const config = await loadOptionalConfig();
    if (!config) throw new Error("请先完成全局配置。");
    return shell.openPath(getOutputRoot(config.outputRoot));
  });
  ipcMain.handle(IPC_CHANNELS.systemSelectDirectory, async (_event, initialPath: unknown) => {
    if (initialPath !== undefined && typeof initialPath !== "string") {
      throw new Error("初始目录无效。");
    }
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      ...(initialPath ? { defaultPath: normalizeAbsolutePath(initialPath) } : {}),
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseTemplateContentRequest(input: unknown) {
  if (!isRecord(input) || typeof input.content !== "string") {
    throw new Error("模板内容无效。");
  }
  return {
    reportType: parseTemplateReportType(input.reportType),
    content: input.content,
    period: PeriodSchema.parse(input.period),
    ...(typeof input.reportTitle === "string" ? { reportTitle: input.reportTitle } : {}),
  };
}

function parseTemplateRevisionRequest(input: unknown) {
  if (!isRecord(input) || typeof input.expectedRevision !== "string") {
    throw new Error("模板版本不能为空。");
  }
  return {
    reportType: parseTemplateReportType(input.reportType),
    expectedRevision: input.expectedRevision,
    ...(typeof input.content === "string" ? { content: input.content } : {}),
    ...(input.period === undefined ? {} : { period: PeriodSchema.parse(input.period) }),
  };
}

function parseTemplateReportType(value: unknown) {
  return value === undefined ? "weekly" : ReportTypeSchema.parse(value);
}
