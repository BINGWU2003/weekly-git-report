import { contextBridge, ipcRenderer } from "electron";
import type { Config } from "@weekly-git-report/shared";

import type { DesktopAPI, SaveRepositoryRequest } from "../../shared/ipc.js";
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
    state: () => ipcRenderer.invoke(IPC_CHANNELS.configState),
    defaults: () => ipcRenderer.invoke(IPC_CHANNELS.configDefaults),
    initialize: (config: Config) => ipcRenderer.invoke(IPC_CHANNELS.configInitialize, config),
    save: (config: Config, expectedRevision: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.configSave, config, expectedRevision),
  }),
  projects: Object.freeze({
    list: () => ipcRenderer.invoke(IPC_CHANNELS.projectsList),
    state: () => ipcRenderer.invoke(IPC_CHANNELS.projectsState),
    inspect: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.projectsInspect, url),
    save: (request: SaveRepositoryRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.projectsSave, request),
    setEnabled: (id: string, enabled: boolean, expectedRevision: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.projectsSetEnabled, id, enabled, expectedRevision),
    sync: (ids?: string[]) => ipcRenderer.invoke(IPC_CHANNELS.projectsSync, ids),
    remove: (id: string, deleteCache: boolean, expectedRevision: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.projectsRemove, id, deleteCache, expectedRevision),
  }),
  reports: Object.freeze({
    list: () => ipcRenderer.invoke(IPC_CHANNELS.reportsList),
    read: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.reportsRead, id),
    showInFolder: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.reportsShowInFolder, id),
  }),
  system: Object.freeze({
    diagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.systemDiagnostics),
    openOutputRoot: () => ipcRenderer.invoke(IPC_CHANNELS.systemOpenOutputRoot),
    selectDirectory: (initialPath?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.systemSelectDirectory, initialPath),
  }),
});

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
