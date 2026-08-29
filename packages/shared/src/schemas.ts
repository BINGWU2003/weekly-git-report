import { z } from "zod";

import { DEFAULT_CONFIG, REPORT_CADENCES, REPORT_TYPES } from "./constants.js";

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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

export const ReportCadenceSchema = z.enum(REPORT_CADENCES);
export const ReportTypeSchema = z.enum(REPORT_TYPES);

export const AiProviderSchema = z.enum(["openai", "deepseek"]);
export const ReportGeneratorSchema = z.enum(["external-agent", "builtin-ai"]);

export const SummaryProvenanceSchema = z
  .object({
    reportId: z.string().trim().min(1),
    runId: z.string().trim().min(1),
    taskId: z.string().trim().min(1).optional(),
    generator: ReportGeneratorSchema,
    provider: AiProviderSchema.optional(),
    model: z.string().trim().min(1).optional(),
    templateRevision: z.string().trim().min(1),
    rawManifestHash: z.string().regex(/^sha256:[a-f\d]{64}$/),
    userNotesHash: z
      .string()
      .regex(/^sha256:[a-f\d]{64}$/)
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.generator === "builtin-ai" && (!value.provider || !value.model)) {
      context.addIssue({
        code: "custom",
        message: "Built-in AI summaries require provider and model provenance.",
      });
    }
    if (value.generator === "external-agent" && (value.provider || value.model)) {
      context.addIssue({
        code: "custom",
        message: "External Agent summaries cannot claim an internal provider or model.",
      });
    }
  });

export const SummaryMetadataSchema = z
  .object({
    version: z.literal(2),
    reportId: z.string().trim().min(1),
    reportType: ReportTypeSchema,
    title: z.string().trim().min(1).max(200).optional(),
    runId: z.string().trim().min(1),
    taskId: z.string().trim().min(1).optional(),
    generator: ReportGeneratorSchema,
    provider: AiProviderSchema.optional(),
    model: z.string().trim().min(1).optional(),
    templateRevision: z.string().trim().min(1),
    rawManifestHash: z.string().regex(/^sha256:[a-f\d]{64}$/),
    userNotesHash: z
      .string()
      .regex(/^sha256:[a-f\d]{64}$/)
      .optional(),
    period: PeriodSchema,
    savedAt: z.string().datetime(),
    contentHash: z.string().regex(/^sha256:[a-f\d]{64}$/),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.generator === "builtin-ai" && (!value.provider || !value.model)) {
      context.addIssue({
        code: "custom",
        message: "Built-in AI summaries require provider and model provenance.",
      });
    }
    if (value.generator === "external-agent" && (value.provider || value.model)) {
      context.addIssue({
        code: "custom",
        message: "External Agent summaries cannot claim an internal provider or model.",
      });
    }
  });

export const AiConfigSchema = z
  .object({
    version: z.literal(1),
    provider: AiProviderSchema,
    apiKey: z.string().min(1),
    dataSharingAcceptedAt: z.string().datetime(),
    testedAt: z.string().datetime().optional(),
  })
  .strict();

export const FeishuConfigSchema = z
  .object({
    version: z.literal(1),
    webhookUrl: z.string().url(),
    signingSecret: z.string().min(1).optional(),
    testedAt: z.string().datetime().optional(),
  })
  .strict();

export const ReportTaskModeSchema = z.enum(["draft", "autoPublish"]);
export const ReportTaskScheduleSchema = z
  .object({
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    includeWeekends: z.boolean().default(false),
  })
  .strict();

export const ReportTaskSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    cadence: ReportCadenceSchema,
    enabled: z.boolean(),
    mode: ReportTaskModeSchema,
    publishToFeishu: z.boolean().default(false),
    projectIds: z.array(z.string().trim().min(1)).default([]),
    userContext: z.string().trim().max(20_000).optional(),
    schedule: ReportTaskScheduleSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const TasksDocumentSchema = z
  .object({
    version: z.literal(1),
    tasks: z.array(ReportTaskSchema),
  })
  .strict();

export const ReportRunStatusSchema = z.enum([
  "queued",
  "collecting",
  "generating",
  "awaiting_review",
  "saving",
  "publishing",
  "succeeded",
  "publish_failed",
  "failed",
  "cancelled",
  "abandoned",
]);
export const ReportRunTriggerSchema = z.enum(["manual", "scheduled", "external-agent"]);
export const ReportRunStepNameSchema = z.enum(["collect", "generate", "review", "save", "publish"]);
export const ReportRunStepStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export const TokenUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  })
  .strict();
export const ReportRunErrorSchema = z
  .object({
    code: z.string().trim().min(1),
    message: z.string(),
    retryableFrom: ReportRunStepNameSchema.optional(),
  })
  .strict();
export const ReportRunStepSchema = z
  .object({
    name: ReportRunStepNameSchema,
    attempt: z.number().int().positive(),
    status: ReportRunStepStatusSchema,
    startedAt: z.string().datetime().optional(),
    finishedAt: z.string().datetime().optional(),
    error: ReportRunErrorSchema.optional(),
  })
  .strict();
export const ReportRunSchema = z
  .object({
    id: z.string().trim().min(1),
    reportId: z.string().trim().min(1),
    reportType: ReportTypeSchema,
    title: z.string().trim().min(1).max(200).optional(),
    taskId: z.string().trim().min(1).optional(),
    taskSnapshot: ReportTaskSchema.optional(),
    period: PeriodSchema,
    trigger: ReportRunTriggerSchema,
    generator: ReportGeneratorSchema,
    status: ReportRunStatusSchema,
    attempt: z.number().int().positive(),
    provider: AiProviderSchema.optional(),
    model: z.string().trim().min(1).optional(),
    tokenUsage: TokenUsageSchema.optional(),
    rawManifestPath: z.string().optional(),
    rawManifestHash: z
      .string()
      .regex(/^sha256:[a-f\d]{64}$/)
      .optional(),
    generationInputPath: z.string().optional(),
    generationInputHash: z
      .string()
      .regex(/^sha256:[a-f\d]{64}$/)
      .optional(),
    templateRevision: z.string().optional(),
    draftPath: z.string().optional(),
    summaryPath: z.string().optional(),
    error: ReportRunErrorSchema.optional(),
    steps: z.array(ReportRunStepSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    finishedAt: z.string().datetime().optional(),
  })
  .strict();

export const GenerationCommitSchema = z
  .object({
    hash: z.string().trim().min(1),
    committedAt: z.string().trim().min(1),
    subject: z.string(),
    body: z.string(),
    authorName: z.string(),
  })
  .strict();
export const GenerationRepositorySchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    branch: z.string().trim().min(1),
    commits: z.array(GenerationCommitSchema),
  })
  .strict();
export const GenerationInputSchema = z
  .object({
    version: z.literal(2),
    runId: z.string().trim().min(1),
    reportId: z.string().trim().min(1),
    reportType: ReportTypeSchema,
    reportTitle: z.string().trim().min(1).max(200).optional(),
    period: PeriodSchema,
    createdAt: z.string().datetime(),
    templateRevision: z.string().trim().min(1),
    rawManifestHash: z.string().regex(/^sha256:[a-f\d]{64}$/),
    userContext: z.string().max(20_000).optional(),
    repositories: z.array(GenerationRepositorySchema),
  })
  .strict();

export const ConfigSchema = z
  .object({
    outputRoot: z.string().trim().min(1).default(DEFAULT_CONFIG.outputRoot),
    repositoryCacheRoot: z.string().trim().min(1).default(DEFAULT_CONFIG.repositoryCacheRoot),
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

export const SaveSummaryInputSchema = SaveWeekSummaryInputSchema.extend({
  reportType: ReportTypeSchema.default("weekly"),
  reportId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  force: z.boolean().default(false),
  provenance: SummaryProvenanceSchema.optional(),
});

export const SummaryTemplateDocumentSchema = z.object({
  content: z.string(),
  renderedContent: z.string().nullable(),
  path: z.string(),
  revision: z.string(),
  defaultRevision: z.string(),
  isDefault: z.boolean(),
});

export const SummaryTemplateResultSchema = z.object({
  formatVersion: z.literal(1),
  type: ReportTypeSchema,
  template: SummaryTemplateDocumentSchema,
  created: z.boolean(),
});

export const McpToolInputSchema = z.union([
  ListProjectsInputSchema,
  SyncProjectsInputSchema,
  CollectGitLogsInputSchema,
  GetWeekIndexInputSchema,
  ReadWeekRawInputSchema,
  SaveWeekSummaryInputSchema,
]);
