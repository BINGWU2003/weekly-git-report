import { ipcMain, shell } from "electron";
import { getOutputRoot } from "@weekly-git-report/core";

import { IPC_CHANNELS } from "../../../shared/ipc.js";
import {
  getDesktopOverview,
  getDiagnostics,
  getReportAbsolutePath,
  listReportFiles,
  loadOptionalConfig,
  loadOptionalProjects,
  readReportFile,
} from "../services/desktop-service.js";

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.overviewGet, () => getDesktopOverview());
  ipcMain.handle(IPC_CHANNELS.configGet, () => loadOptionalConfig());
  ipcMain.handle(IPC_CHANNELS.projectsList, () => loadOptionalProjects());
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
}
