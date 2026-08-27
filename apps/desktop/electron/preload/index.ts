import { contextBridge, ipcRenderer } from "electron";

import type { DesktopAPI } from "../../shared/ipc.js";
import { IPC_CHANNELS } from "../../shared/ipc.js";

const electronAPI: DesktopAPI = Object.freeze({
  platform: process.platform,
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  }),
  overview: Object.freeze({
    get: () => ipcRenderer.invoke(IPC_CHANNELS.overviewGet),
  }),
  config: Object.freeze({
    get: () => ipcRenderer.invoke(IPC_CHANNELS.configGet),
  }),
  projects: Object.freeze({
    list: () => ipcRenderer.invoke(IPC_CHANNELS.projectsList),
  }),
  reports: Object.freeze({
    list: () => ipcRenderer.invoke(IPC_CHANNELS.reportsList),
    read: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.reportsRead, id),
    showInFolder: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.reportsShowInFolder, id),
  }),
  system: Object.freeze({
    diagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.systemDiagnostics),
    openOutputRoot: () => ipcRenderer.invoke(IPC_CHANNELS.systemOpenOutputRoot),
  }),
});

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
