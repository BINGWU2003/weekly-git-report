import { dialog, ipcMain, shell } from "electron";
import { getOutputRoot, normalizeAbsolutePath } from "@weekly-git-report/core";
import { ConfigSchema, RepositoryProjectSchema } from "@weekly-git-report/shared";

import { IPC_CHANNELS } from "../../../shared/ipc.js";
import {
  getDesktopOverview,
  getConfigInitializationDefaults,
  getConfigState,
  getDiagnostics,
  getProjectsState,
  getReportAbsolutePath,
  initializeDesktopConfig,
  inspectRepository,
  listReportFiles,
  loadOptionalConfig,
  loadOptionalProjects,
  readReportFile,
  removeDesktopRepository,
  saveDesktopConfig,
  saveDesktopRepository,
  setDesktopRepositoryEnabled,
  syncDesktopRepositories,
} from "../services/desktop-service.js";

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.overviewGet, () => getDesktopOverview());
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
  ipcMain.handle(IPC_CHANNELS.projectsList, () => loadOptionalProjects());
  ipcMain.handle(IPC_CHANNELS.projectsState, () => getProjectsState());
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
  ipcMain.handle(IPC_CHANNELS.reportsList, () => listReportFiles());
  ipcMain.handle(IPC_CHANNELS.reportsRead, (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Report id is required.");
    return readReportFile(id);
  });
  ipcMain.handle(IPC_CHANNELS.reportsShowInFolder, async (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Report id is required.");
    shell.showItemInFolder(await getReportAbsolutePath(id));
  });
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
