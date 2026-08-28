import { z } from "zod";

import { DEFAULT_CONFIG } from "./constants.js";

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const defaultSinceSchema = z.union([z.literal("last monday"), dateStringSchema]);
const defaultUntilSchema = z.union([z.literal("now"), dateStringSchema]);

export const AuthorListSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const author = value.trim();
    return author ? [author] : [];
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
}, z.array(z.string()).default([]));

export const IdentitySchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
});

export const PeriodSchema = z.object({
  start: dateStringSchema,
  end: dateStringSchema,
});

export const ConfigSchema = z
  .object({
    outputRoot: z.string().trim().min(1).default(DEFAULT_CONFIG.outputRoot),
    repositoryCacheRoot: z.string().trim().min(1).default(DEFAULT_CONFIG.repositoryCacheRoot),
    defaultSince: defaultSinceSchema.optional().default(DEFAULT_CONFIG.defaultSince),
    defaultUntil: defaultUntilSchema.optional().default(DEFAULT_CONFIG.defaultUntil),
    includeEmptyProjects: z.boolean().default(DEFAULT_CONFIG.includeEmptyProjects),
    identities: z.array(IdentitySchema).min(1),
  })
  .strict();

export const RepositoryProjectSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  url: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  localPath: z.string().trim().min(1),
  authors: z.array(IdentitySchema).min(1).optional(),
  enabled: z.boolean().default(true),
});

export const ProjectsIndexSchema = z
  .object({
    projects: z.array(RepositoryProjectSchema),
  })
  .strict();

export const ProjectSchema = RepositoryProjectSchema.extend({
  fileName: z.string(),
  path: z.string(),
  remote: z.string(),
});

export const CollectOptionsSchema = z.object({
  since: z.string(),
  until: z.string(),
  author: AuthorListSchema,
  projectIds: z.array(z.string()).default([]),
  backup: z.boolean().default(false),
});

export const ManifestProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  file: z.string(),
  path: z.string(),
  remote: z.string().optional(),
  branch: z.string().optional(),
  commitCount: z.number().int().nonnegative(),
  contentHash: z.string(),
});

export const ManifestErrorSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().optional(),
  path: z.string().optional(),
  message: z.string(),
});

export const LatestCommitSchema = z.object({
  hash: z.string().min(1),
  subject: z.string(),
  authorName: z.string(),
  authorEmail: z.string(),
  committedAt: z.string(),
});

export const RepositoryRuntimeStatusSchema = z.enum([
  "ready",
  "not-synced",
  "missing-branch",
  "error",
]);

export const RepositoryRuntimeStateSchema = z.object({
  projectId: z.string(),
  status: RepositoryRuntimeStatusSchema,
  latestCommit: LatestCommitSchema.nullable(),
  message: z.string().optional(),
});

export const LocalRepositoryDiscoverySchema = z.object({
  sourcePath: z.string(),
  isBare: z.boolean(),
  originUrl: z.string().optional(),
});

export const RepositoryScanWarningSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const RepositoryFolderScanResultSchema = z.object({
  root: z.string(),
  scannedDirectories: z.number().int().nonnegative(),
  repositories: z.array(LocalRepositoryDiscoverySchema),
  warnings: z.array(RepositoryScanWarningSchema),
  truncated: z.boolean(),
});

export const ManifestSchema = z.object({
  version: z.literal(1),
  period: PeriodSchema,
  generatedAt: z.string(),
  outputRoot: z.string(),
  outputDir: z.string(),
  projects: z.array(ManifestProjectSchema),
  errors: z.array(ManifestErrorSchema),
});

export const ListProjectsInputSchema = z.object({});

export const SyncProjectsInputSchema = z.object({
  projectIds: z.array(z.string()).default([]),
});

export const CollectGitLogsInputSchema = z.object({
  since: dateStringSchema,
  until: dateStringSchema,
  author: AuthorListSchema,
  projectIds: z.array(z.string()).default([]),
});

export const GetWeekIndexInputSchema = PeriodSchema;
export const ReadWeekRawInputSchema = PeriodSchema;
export const SaveWeekSummaryInputSchema = PeriodSchema.extend({
  content: z.string().min(1),
});

export const McpToolInputSchema = z.union([
  ListProjectsInputSchema,
  SyncProjectsInputSchema,
  CollectGitLogsInputSchema,
  GetWeekIndexInputSchema,
  ReadWeekRawInputSchema,
  SaveWeekSummaryInputSchema,
]);
