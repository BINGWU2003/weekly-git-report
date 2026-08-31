import type {
  Config,
  AiProvider,
  Identity,
  IndexedReportFile,
  ManifestError,
  RepositoryFolderScanResult,
  RepositoryProject,
  RepositoryRuntimeState,
  Period,
  ReportType,
  ReportRun,
  TasksDocument,
  SummaryTemplateResult,
} from "@weekly-git-report/shared";

export interface ConfigState {
  config: Config | null;
  revision: string | null;
  workspaceError?: string;
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
  reportType: ReportType;
  content: string;
  expectedRevision: string;
  period?: Period;
}

export interface SummaryTemplateResetRequest {
  reportType: ReportType;
  expectedRevision: string;
  period?: Period;
}

export interface SummaryTemplatePreviewRequest {
  reportType: ReportType;
  content: string;
  period: Period;
  reportTitle?: string;
}

export type DiagnosticStatus = "ok" | "warning" | "error";

export interface DiagnosticCheck {
  id: "git" | "config" | "projects" | "output" | "workspace";
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
  enabledTaskCount: number;
  runCounts: Partial<Record<ReportRun["status"], number>>;
  diagnostics: DiagnosticCheck[];
}

export interface SecretConfigurationStatus {
  configured: boolean;
  provider?: AiProvider;
  baseUrl?: string;
  model?: string;
  dataSharingAccepted?: boolean;
  signingEnabled?: boolean;
  testedAt?: string;
  apiKeyMasked?: string;
  webhookUrlMasked?: string;
  signingSecretMasked?: string;
}

export interface AiConfigurationUpdate {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
  dataSharingAccepted: boolean;
}

export interface FeishuConfigurationUpdate {
  webhookUrl?: string;
  signingSecret?: string | null;
}

export interface SecretRevealResult {
  value: string;
}

export type DesktopUpdatePhase =
  | "disabled"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

export interface DesktopUpdateStatus {
  phase: DesktopUpdatePhase;
  currentVersion: string;
  latestVersion?: string;
  releaseName?: string;
  releaseDate?: string;
  releaseNotes?: string;
  releaseUrl: string;
  progress?: number;
  checkedAt?: string;
  error?: string;
  failedAction?: "check" | "download";
  disabledReason?: string;
  installBlockedReason?: string;
}

export interface DesktopReadiness {
  gitReady: boolean;
  configReady: boolean;
  workspaceReady: boolean;
  repositoryReady: boolean;
  enabledRepositoryCount: number;
  aiReady: boolean;
  aiTested: boolean;
  aiSkipped: boolean;
  templatesReady: boolean;
  templateTypesReady: ReportType[];
  feishuReady: boolean;
  firstReportReady: boolean;
}

export interface OnboardingState {
  version: 1;
  completedAt?: string;
  firstRunId?: string;
  aiSkippedAt?: string;
  firstRun?: ReportRun;
  readiness: DesktopReadiness;
}

export interface TasksState {
  document: TasksDocument;
  revision: string | null;
}

export interface GenerateReportRequest {
  reportType: ReportType;
  period: Period;
  reportId?: string;
  title?: string;
  projectIds?: string[];
  userContext?: string;
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
  onboarding: {
    state(): Promise<OnboardingState>;
    rememberRun(runId: string | null): Promise<OnboardingState>;
    complete(runId: string): Promise<OnboardingState>;
    skipAi(): Promise<OnboardingState>;
  };
  config: {
    get(): Promise<Config | null>;
    state(): Promise<ConfigState>;
    defaults(): Promise<ConfigInitializationDefaults>;
    initialize(config: Config): Promise<ConfigState>;
    save(config: Config, expectedRevision: string): Promise<ConfigState>;
  };
  templates: {
    read(
      reportType?: ReportType,
      period?: Period,
      reportTitle?: string,
    ): Promise<SummaryTemplateResult>;
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
    list(trashed?: boolean): Promise<ReportFile[]>;
    read(id: string): Promise<ReportDocument>;
    showInFolder(id: string): Promise<void>;
    publish(id: string): Promise<void>;
    trash(id: string): Promise<void>;
    restore(id: string): Promise<void>;
    deletePermanently(id: string): Promise<void>;
  };
  ai: {
    status(): Promise<SecretConfigurationStatus>;
    reveal(): Promise<SecretRevealResult>;
    configure(input: AiConfigurationUpdate): Promise<SecretConfigurationStatus>;
    test(): Promise<SecretConfigurationStatus>;
    clear(): Promise<SecretConfigurationStatus>;
  };
  feishu: {
    status(): Promise<SecretConfigurationStatus>;
    reveal(field: "webhookUrl" | "signingSecret"): Promise<SecretRevealResult>;
    configure(input: FeishuConfigurationUpdate): Promise<SecretConfigurationStatus>;
    test(): Promise<SecretConfigurationStatus>;
    clear(): Promise<SecretConfigurationStatus>;
  };
  tasks: {
    state(): Promise<TasksState>;
    save(document: TasksDocument, expectedRevision: string | null): Promise<TasksState>;
    run(id: string): Promise<ReportRun>;
  };
  runs: {
    list(limit?: number): Promise<ReportRun[]>;
    get(id: string): Promise<ReportRun>;
    readDraft(id: string): Promise<string>;
    generate(request: GenerateReportRequest): Promise<ReportRun>;
    approve(id: string, content: string, publish?: boolean, force?: boolean): Promise<ReportRun>;
    cancel(id: string): Promise<ReportRun>;
    retry(id: string, allowEmpty?: boolean): Promise<ReportRun>;
    publish(id: string): Promise<ReportRun>;
    onGenerationDelta(listener: (runId: string, delta: string) => void): () => void;
  };
  updates: {
    status(): Promise<DesktopUpdateStatus>;
    check(): Promise<DesktopUpdateStatus>;
    download(): Promise<DesktopUpdateStatus>;
    install(): Promise<void>;
    openRelease(): Promise<void>;
    openLogs(): Promise<string>;
    onStatusChange(listener: (status: DesktopUpdateStatus) => void): () => void;
  };
  system: {
    diagnostics(): Promise<DiagnosticCheck[]>;
    openOutputRoot(): Promise<string>;
    selectDirectory(initialPath?: string): Promise<string | null>;
  };
}

export const IPC_CHANNELS = {
  overviewGet: "overview:get",
  onboardingState: "onboarding:state",
  onboardingRememberRun: "onboarding:remember-run",
  onboardingComplete: "onboarding:complete",
  onboardingSkipAi: "onboarding:skip-ai",
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
  reportsPublish: "reports:publish",
  reportsTrash: "reports:trash",
  reportsRestore: "reports:restore",
  reportsDeletePermanently: "reports:delete-permanently",
  aiStatus: "ai:status",
  aiReveal: "ai:reveal",
  aiConfigure: "ai:configure",
  aiTest: "ai:test",
  aiClear: "ai:clear",
  feishuStatus: "feishu:status",
  feishuReveal: "feishu:reveal",
  feishuConfigure: "feishu:configure",
  feishuTest: "feishu:test",
  feishuClear: "feishu:clear",
  tasksState: "tasks:state",
  tasksSave: "tasks:save",
  tasksRun: "tasks:run",
  runsList: "runs:list",
  runsGet: "runs:get",
  runsReadDraft: "runs:read-draft",
  runsGenerate: "runs:generate",
  runsApprove: "runs:approve",
  runsCancel: "runs:cancel",
  runsRetry: "runs:retry",
  runsPublish: "runs:publish",
  runsGenerationDelta: "runs:generation-delta",
  updatesStatus: "updates:status",
  updatesCheck: "updates:check",
  updatesDownload: "updates:download",
  updatesInstall: "updates:install",
  updatesOpenRelease: "updates:open-release",
  updatesOpenLogs: "updates:open-logs",
  updatesStatusChanged: "updates:status-changed",
  systemDiagnostics: "system:diagnostics",
  systemOpenOutputRoot: "system:open-output-root",
  systemSelectDirectory: "system:select-directory",
} as const;
