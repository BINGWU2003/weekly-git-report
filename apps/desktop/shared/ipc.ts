import type { Config, RepositoryProject } from "@weekly-git-report/shared";

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
  };
  projects: {
    list(): Promise<RepositoryProject[]>;
  };
  reports: {
    list(): Promise<ReportFile[]>;
    read(id: string): Promise<ReportDocument>;
    showInFolder(id: string): Promise<void>;
  };
  system: {
    diagnostics(): Promise<DiagnosticCheck[]>;
    openOutputRoot(): Promise<string>;
  };
}

export const IPC_CHANNELS = {
  overviewGet: "overview:get",
  configGet: "config:get",
  projectsList: "projects:list",
  reportsList: "reports:list",
  reportsRead: "reports:read",
  reportsShowInFolder: "reports:show-in-folder",
  systemDiagnostics: "system:diagnostics",
  systemOpenOutputRoot: "system:open-output-root",
} as const;
