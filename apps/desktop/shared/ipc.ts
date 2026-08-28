import type { Config, Identity, ManifestError, RepositoryProject } from "@weekly-git-report/shared";

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

export interface RepositorySyncResult {
  synced: string[];
  errors: ManifestError[];
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

export interface ReportFile {
  id: string;
  name: string;
  relativePath: string;
  kind: "raw" | "summary" | "task" | "other";
  modifiedAt: string;
  size: number;
}

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
  projects: {
    list(): Promise<RepositoryProject[]>;
    state(): Promise<ProjectsState>;
    inspect(url: string): Promise<RemoteRepositoryDetails>;
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
  projectsList: "projects:list",
  projectsState: "projects:state",
  projectsInspect: "projects:inspect",
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
