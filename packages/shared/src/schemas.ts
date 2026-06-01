import { z } from "zod";

import { DEFAULT_CONFIG } from "./constants.js";

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const AuthorListSchema = z.preprocess(
  (value) => {
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
  },
  z.array(z.string()).default([]),
);

export const PeriodSchema = z.object({
  start: dateStringSchema,
  end: dateStringSchema,
});

export const ConfigSchema = z.object({
  roots: z.array(z.string()).min(1).default([...DEFAULT_CONFIG.roots]),
  excludeDirs: z.array(z.string()).default([...DEFAULT_CONFIG.excludeDirs]),
  maxDepth: z.number().int().positive().default(DEFAULT_CONFIG.maxDepth),
  outputRoot: z.string().default(DEFAULT_CONFIG.outputRoot),
  author: AuthorListSchema,
  defaultSince: z.string().optional().default(DEFAULT_CONFIG.defaultSince),
  defaultUntil: z.string().optional().default(DEFAULT_CONFIG.defaultUntil),
  includeEmptyProjects: z
    .boolean()
    .default(DEFAULT_CONFIG.includeEmptyProjects),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  fileName: z.string(),
  path: z.string(),
  remote: z.string().optional(),
  branch: z.string().optional(),
  lastCommitAt: z.string().optional(),
  isDuplicate: z.boolean().default(false),
});

export const ProjectsIndexSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  projects: z.array(ProjectSchema),
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

export const ScanProjectsInputSchema = z.object({
  roots: z.array(z.string()).optional(),
  maxDepth: z.number().int().positive().optional(),
});

export const CollectGitLogsInputSchema = z.object({
  since: dateStringSchema,
  until: dateStringSchema,
  author: AuthorListSchema,
  projectIds: z.array(z.string()).default([]),
});

export const GetWeekIndexInputSchema = PeriodSchema;
export const ReadWeekRawInputSchema = PeriodSchema;

export const McpToolInputSchema = z.union([
  ListProjectsInputSchema,
  ScanProjectsInputSchema,
  CollectGitLogsInputSchema,
  GetWeekIndexInputSchema,
  ReadWeekRawInputSchema,
]);
