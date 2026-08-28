import type {
  Config,
  Identity,
  IndexedReportFile,
  ManifestError,
  RepositoryFolderScanResult,
  RepositoryProject,
  RepositoryRuntimeState,
  Period,
  ReportCadence,
  SummaryTemplateResult,
} from "@weekly-git-report/shared";

export interface ConfigState {
  config: Config | null;
  revision: string | null;
}

export interface ConfigInitializationDefaults {
  config: Config;
  detectedIdentity: Identity | null;
}

export interface ProjectsState {
  projects: RepositoryProject[];
  revision: string | null;
}

export interface RemoteRepositoryDetails {
  branches: string[];
  defaultBranch?: string;
  suggestedId: string;
  suggestedName: string;
  suggestedLocalPath: string;
}

export interface SaveRepositoryRequest {
  project: RepositoryProject;
  currentId?: string;
  expectedRevision: string;
}

export interface ImportRepositoriesRequest {
  projects: RepositoryProject[];
  expectedRevision: string;
}

export interface ImportRepositoriesResult {
  state: ProjectsState;
  added: string[];
  errors: ManifestError[];
}

export interface RepositorySyncResult {
  synced: string[];
  errors: ManifestError[];
  runtime: RepositoryRuntimeState[];
}

export interface SummaryTemplateSaveRequest {
  cadence: ReportCadence;
  content: string;
  expectedRevision: string;
  period?: Period;
}

export interface SummaryTemplateResetRequest {
  cadence: ReportCadence;
  expectedRevision: string;
  period?: Period;
}

export interface SummaryTemplatePreviewRequest {
  cadence: ReportCadence;
  content: string;
  period: Period;
}

export type DiagnosticStatus = "ok" | "warning" | "error";

export interface DiagnosticCheck {
  id: "git" | "config" | "projects" | "output";
  label: string;
  status: DiagnosticStatus;
  message: string;
}

export interface DesktopOverview {
  initialized: boolean;
  config: Config | null;
  projectCount: number;
  enabledProjectCount: number;
  reportCount: number;
  diagnostics: DiagnosticCheck[];
}

export type ReportFile = IndexedReportFile;

export interface ReportDocument extends ReportFile {
  content: string;
}

export interface DesktopAPI {
  readonly platform: string;
  readonly versions: Readonly<{
    chrome: string;
    electron: string;
    node: string;
  }>;
  overview: {
    get(): Promise<DesktopOverview>;
  };
  config: {
    get(): Promise<Config | null>;
    state(): Promise<ConfigState>;
    defaults(): Promise<ConfigInitializationDefaults>;
    initialize(config: Config): Promise<ConfigState>;
    save(config: Config, expectedRevision: string): Promise<ConfigState>;
  };
  templates: {
    read(cadence?: ReportCadence, period?: Period): Promise<SummaryTemplateResult>;
    preview(request: SummaryTemplatePreviewRequest): Promise<string>;
    save(request: SummaryTemplateSaveRequest): Promise<SummaryTemplateResult>;
    reset(request: SummaryTemplateResetRequest): Promise<SummaryTemplateResult>;
  };
  projects: {
    list(): Promise<RepositoryProject[]>;
    state(): Promise<ProjectsState>;
    runtimeState(): Promise<RepositoryRuntimeState[]>;
    scanFolder(folder: string): Promise<RepositoryFolderScanResult>;
    inspect(url: string): Promise<RemoteRepositoryDetails>;
    importRepositories(request: ImportRepositoriesRequest): Promise<ImportRepositoriesResult>;
    save(request: SaveRepositoryRequest): Promise<ProjectsState>;
    setEnabled(id: string, enabled: boolean, expectedRevision: string): Promise<ProjectsState>;
    sync(ids?: string[]): Promise<RepositorySyncResult>;
    remove(id: string, deleteCache: boolean, expectedRevision: string): Promise<ProjectsState>;
  };
  reports: {
    list(): Promise<ReportFile[]>;
    read(id: string): Promise<ReportDocument>;
    showInFolder(id: string): Promise<void>;
  };
  system: {
    diagnostics(): Promise<DiagnosticCheck[]>;
    openOutputRoot(): Promise<string>;
    selectDirectory(initialPath?: string): Promise<string | null>;
  };
}

export const IPC_CHANNELS = {
  overviewGet: "overview:get",
  configGet: "config:get",
  configState: "config:state",
  configDefaults: "config:defaults",
  configInitialize: "config:initialize",
  configSave: "config:save",
  templatesRead: "templates:read",
  templatesPreview: "templates:preview",
  templatesSave: "templates:save",
  templatesReset: "templates:reset",
  projectsList: "projects:list",
  projectsState: "projects:state",
  projectsRuntimeState: "projects:runtime-state",
  projectsScanFolder: "projects:scan-folder",
  projectsInspect: "projects:inspect",
  projectsImport: "projects:import",
  projectsSave: "projects:save",
  projectsSetEnabled: "projects:set-enabled",
  projectsSync: "projects:sync",
  projectsRemove: "projects:remove",
  reportsList: "reports:list",
  reportsRead: "reports:read",
  reportsShowInFolder: "reports:show-in-folder",
  systemDiagnostics: "system:diagnostics",
  systemOpenOutputRoot: "system:open-output-root",
  systemSelectDirectory: "system:select-directory",
} as const;
