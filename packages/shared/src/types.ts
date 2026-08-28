import type { z } from "zod";

import type {
  CollectGitLogsInputSchema,
  CollectOptionsSchema,
  AuthorListSchema,
  ConfigSchema,
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
  ProjectSchema,
  RepositoryProjectSchema,
  RepositoryFolderScanResultSchema,
  RepositoryRuntimeStateSchema,
  RepositoryRuntimeStatusSchema,
  RepositoryScanWarningSchema,
  ProjectsIndexSchema,
  ReadWeekRawInputSchema,
  SaveWeekSummaryInputSchema,
  SummaryTemplateDocumentSchema,
  SummaryTemplateResultSchema,
  SyncProjectsInputSchema,
} from "./schemas.js";

export type AuthorList = z.infer<typeof AuthorListSchema>;
export type Identity = z.infer<typeof IdentitySchema>;
export type Period = z.infer<typeof PeriodSchema>;
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
export type GetWeekIndexInput = z.infer<typeof GetWeekIndexInputSchema>;
export type ReadWeekRawInput = z.infer<typeof ReadWeekRawInputSchema>;
export type SaveWeekSummaryInput = z.infer<typeof SaveWeekSummaryInputSchema>;
export type SummaryTemplateDocument = z.infer<typeof SummaryTemplateDocumentSchema>;
export type SummaryTemplateResult = z.infer<typeof SummaryTemplateResultSchema>;
export type McpToolInput = z.infer<typeof McpToolInputSchema>;
