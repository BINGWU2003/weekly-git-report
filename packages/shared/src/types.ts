import type { z } from "zod";

import type {
  AiConfigSchema,
  AiProviderSchema,
  CollectGitLogsInputSchema,
  CompleteReportInputSchema,
  CollectOptionsSchema,
  AuthorListSchema,
  ConfigSchema,
  FeishuConfigSchema,
  FailReportInputSchema,
  GenerationCommitSchema,
  GenerationInputSchema,
  GenerationRepositorySchema,
  IdentitySchema,
  GetWeekIndexInputSchema,
  ListProjectsInputSchema,
  LatestCommitSchema,
  LocalRepositoryDiscoverySchema,
  ManifestErrorSchema,
  ManifestProjectSchema,
  ManifestSchema,
  McpToolInputSchema,
  PeriodSchema,
  PrepareReportInputSchema,
  ProjectSchema,
  RepositoryProjectSchema,
  RepositoryFolderScanResultSchema,
  RepositoryRuntimeStateSchema,
  RepositoryRuntimeStatusSchema,
  RepositoryScanWarningSchema,
  ReportCadenceSchema,
  ReportTypeSchema,
  ReportGeneratorSchema,
  ReportRunErrorSchema,
  ReportRunSchema,
  ReportRunStatusSchema,
  ReportRunStepNameSchema,
  ReportRunStepSchema,
  ReportRunStepStatusSchema,
  ReportRunTriggerSchema,
  ReportTaskModeSchema,
  ReportTaskScheduleSchema,
  ReportTaskSchema,
  ProjectsIndexSchema,
  PublishReportInputSchema,
  ReadWeekRawInputSchema,
  SaveWeekSummaryInputSchema,
  SaveSummaryInputSchema,
  SummaryMetadataSchema,
  SummaryProvenanceSchema,
  SummaryTemplateDocumentSchema,
  SummaryTemplateResultSchema,
  SyncProjectsInputSchema,
  TasksDocumentSchema,
  TokenUsageSchema,
} from "./schemas.js";

export type AuthorList = z.infer<typeof AuthorListSchema>;
export type Identity = z.infer<typeof IdentitySchema>;
export type Period = z.infer<typeof PeriodSchema>;
export type ReportCadence = z.infer<typeof ReportCadenceSchema>;
export type ReportType = z.infer<typeof ReportTypeSchema>;
export type AiProvider = z.infer<typeof AiProviderSchema>;
export type AiConfig = z.infer<typeof AiConfigSchema>;
export type FeishuConfig = z.infer<typeof FeishuConfigSchema>;
export type ReportGenerator = z.infer<typeof ReportGeneratorSchema>;
export type ReportTaskMode = z.infer<typeof ReportTaskModeSchema>;
export type ReportTaskSchedule = z.infer<typeof ReportTaskScheduleSchema>;
export type ReportTask = z.infer<typeof ReportTaskSchema>;
export type TasksDocument = z.infer<typeof TasksDocumentSchema>;
export type ReportRunStatus = z.infer<typeof ReportRunStatusSchema>;
export type ReportRunTrigger = z.infer<typeof ReportRunTriggerSchema>;
export type ReportRunStepName = z.infer<typeof ReportRunStepNameSchema>;
export type ReportRunStepStatus = z.infer<typeof ReportRunStepStatusSchema>;
export type ReportRunError = z.infer<typeof ReportRunErrorSchema>;
export type ReportRunStep = z.infer<typeof ReportRunStepSchema>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export type ReportRun = z.infer<typeof ReportRunSchema>;
export type GenerationCommit = z.infer<typeof GenerationCommitSchema>;
export type GenerationRepository = z.infer<typeof GenerationRepositorySchema>;
export type GenerationInput = z.infer<typeof GenerationInputSchema>;
export type SummaryProvenance = z.infer<typeof SummaryProvenanceSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type RepositoryProject = z.infer<typeof RepositoryProjectSchema>;
export type ProjectsIndex = z.infer<typeof ProjectsIndexSchema>;
export type CollectOptions = z.infer<typeof CollectOptionsSchema>;
export type ManifestProject = z.infer<typeof ManifestProjectSchema>;
export type ManifestError = z.infer<typeof ManifestErrorSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export type LatestCommit = z.infer<typeof LatestCommitSchema>;
export type RepositoryRuntimeStatus = z.infer<typeof RepositoryRuntimeStatusSchema>;
export type RepositoryRuntimeState = z.infer<typeof RepositoryRuntimeStateSchema>;
export type LocalRepositoryDiscovery = z.infer<typeof LocalRepositoryDiscoverySchema>;
export type RepositoryScanWarning = z.infer<typeof RepositoryScanWarningSchema>;
export type RepositoryFolderScanResult = z.infer<typeof RepositoryFolderScanResultSchema>;
export type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;
export type SyncProjectsInput = z.infer<typeof SyncProjectsInputSchema>;
export type CollectGitLogsInput = z.infer<typeof CollectGitLogsInputSchema>;
export type PrepareReportInput = z.infer<typeof PrepareReportInputSchema>;
export type CompleteReportInput = z.infer<typeof CompleteReportInputSchema>;
export type FailReportInput = z.infer<typeof FailReportInputSchema>;
export type PublishReportInput = z.infer<typeof PublishReportInputSchema>;
export type GetWeekIndexInput = z.infer<typeof GetWeekIndexInputSchema>;
export type ReadWeekRawInput = z.infer<typeof ReadWeekRawInputSchema>;
export type SaveWeekSummaryInput = z.infer<typeof SaveWeekSummaryInputSchema>;
export type SaveSummaryInput = z.infer<typeof SaveSummaryInputSchema>;
export type SummaryMetadata = z.infer<typeof SummaryMetadataSchema>;
export type SummaryTemplateDocument = z.infer<typeof SummaryTemplateDocumentSchema>;
export type SummaryTemplateResult = z.infer<typeof SummaryTemplateResultSchema>;
export type McpToolInput = z.infer<typeof McpToolInputSchema>;

export type ReportKind = "raw" | "summary";

export type ReportRole = "summary" | "raw-index" | "raw-project" | "raw-history";

export type SummaryMetadataStatus = "valid" | "legacy" | "invalid";

export interface IndexedReportFile {
  id: string;
  name: string;
  title: string;
  relativePath: string;
  kind: ReportKind;
  role: ReportRole;
  period: Period | null;
  generatedAt: string | null;
  modifiedAt: string;
  size: number;
  reportId?: string;
  reportType?: ReportType;
  templateType?: ReportType;
  reportTitle?: string;
  trashed?: boolean;
  trashedAt?: string;
  originalRelativePath?: string;
  summaryMetadataStatus?: SummaryMetadataStatus;
  summaryMetadataMessage?: string;
  projectId?: string;
  projectName?: string;
}
