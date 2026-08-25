import type { z } from "zod";

import type {
  CollectGitLogsInputSchema,
  CollectOptionsSchema,
  AuthorListSchema,
  ConfigSchema,
  IdentitySchema,
  GetWeekIndexInputSchema,
  ListProjectsInputSchema,
  ManifestErrorSchema,
  ManifestProjectSchema,
  ManifestSchema,
  McpToolInputSchema,
  PeriodSchema,
  ProjectSchema,
  RepositoryProjectSchema,
  ProjectsIndexSchema,
  ReadWeekRawInputSchema,
  SaveWeekSummaryInputSchema,
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
export type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;
export type SyncProjectsInput = z.infer<typeof SyncProjectsInputSchema>;
export type CollectGitLogsInput = z.infer<typeof CollectGitLogsInputSchema>;
export type GetWeekIndexInput = z.infer<typeof GetWeekIndexInputSchema>;
export type ReadWeekRawInput = z.infer<typeof ReadWeekRawInputSchema>;
export type SaveWeekSummaryInput = z.infer<typeof SaveWeekSummaryInputSchema>;
export type McpToolInput = z.infer<typeof McpToolInputSchema>;
