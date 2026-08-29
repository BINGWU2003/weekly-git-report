import { contextBridge, ipcRenderer } from "electron";
import type { Config, Period, ReportType, TasksDocument } from "@weekly-git-report/shared";

import type {
  DesktopAPI,
  AiConfigurationUpdate,
  FeishuConfigurationUpdate,
  GenerateReportRequest,
  ImportRepositoriesRequest,
  SaveRepositoryRequest,
  SummaryTemplatePreviewRequest,
  SummaryTemplateResetRequest,
  SummaryTemplateSaveRequest,
} from "../../shared/ipc.js";
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
  templates: Object.freeze({
    read: (reportType?: ReportType, period?: Period, reportTitle?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.templatesRead, reportType, period, reportTitle),
    preview: (request: SummaryTemplatePreviewRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.templatesPreview, request),
    save: (request: SummaryTemplateSaveRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.templatesSave, request),
    reset: (request: SummaryTemplateResetRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.templatesReset, request),
  }),
  projects: Object.freeze({
    list: () => ipcRenderer.invoke(IPC_CHANNELS.projectsList),
    state: () => ipcRenderer.invoke(IPC_CHANNELS.projectsState),
    runtimeState: () => ipcRenderer.invoke(IPC_CHANNELS.projectsRuntimeState),
    scanFolder: (folder: string) => ipcRenderer.invoke(IPC_CHANNELS.projectsScanFolder, folder),
    inspect: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.projectsInspect, url),
    importRepositories: (request: ImportRepositoriesRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.projectsImport, request),
    save: (request: SaveRepositoryRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.projectsSave, request),
    setEnabled: (id: string, enabled: boolean, expectedRevision: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.projectsSetEnabled, id, enabled, expectedRevision),
    sync: (ids?: string[]) => ipcRenderer.invoke(IPC_CHANNELS.projectsSync, ids),
    remove: (id: string, deleteCache: boolean, expectedRevision: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.projectsRemove, id, deleteCache, expectedRevision),
  }),
  reports: Object.freeze({
    list: (trashed?: boolean) => ipcRenderer.invoke(IPC_CHANNELS.reportsList, trashed),
    read: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.reportsRead, id),
    showInFolder: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.reportsShowInFolder, id),
    publish: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.reportsPublish, id),
    trash: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.reportsTrash, id),
    restore: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.reportsRestore, id),
    deletePermanently: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.reportsDeletePermanently, id),
  }),
  ai: Object.freeze({
    status: () => ipcRenderer.invoke(IPC_CHANNELS.aiStatus),
    reveal: () => ipcRenderer.invoke(IPC_CHANNELS.aiReveal),
    configure: (input: AiConfigurationUpdate) =>
      ipcRenderer.invoke(IPC_CHANNELS.aiConfigure, input),
    test: () => ipcRenderer.invoke(IPC_CHANNELS.aiTest),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.aiClear),
  }),
  feishu: Object.freeze({
    status: () => ipcRenderer.invoke(IPC_CHANNELS.feishuStatus),
    reveal: (field: "webhookUrl" | "signingSecret") =>
      ipcRenderer.invoke(IPC_CHANNELS.feishuReveal, field),
    configure: (input: FeishuConfigurationUpdate) =>
      ipcRenderer.invoke(IPC_CHANNELS.feishuConfigure, input),
    test: () => ipcRenderer.invoke(IPC_CHANNELS.feishuTest),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.feishuClear),
  }),
  tasks: Object.freeze({
    state: () => ipcRenderer.invoke(IPC_CHANNELS.tasksState),
    save: (document: TasksDocument, expectedRevision: string | null) =>
      ipcRenderer.invoke(IPC_CHANNELS.tasksSave, document, expectedRevision),
    run: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.tasksRun, id),
  }),
  runs: Object.freeze({
    list: (limit?: number) => ipcRenderer.invoke(IPC_CHANNELS.runsList, limit),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.runsGet, id),
    readDraft: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.runsReadDraft, id),
    generate: (request: GenerateReportRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.runsGenerate, request),
    approve: (id: string, content: string, publish?: boolean, force?: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.runsApprove, id, content, publish, force),
    cancel: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.runsCancel, id),
    retry: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.runsRetry, id),
    onGenerationDelta: (listener: (runId: string, delta: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, runId: string, delta: string) =>
        listener(runId, delta);
      ipcRenderer.on(IPC_CHANNELS.runsGenerationDelta, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.runsGenerationDelta, handler);
    },
  }),
  system: Object.freeze({
    diagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.systemDiagnostics),
    openOutputRoot: () => ipcRenderer.invoke(IPC_CHANNELS.systemOpenOutputRoot),
    selectDirectory: (initialPath?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.systemSelectDirectory, initialPath),
  }),
});

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
