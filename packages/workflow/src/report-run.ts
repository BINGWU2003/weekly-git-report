import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import {
  collectCommits,
  createGenerationInput,
  getRunDir,
  getRunsDatabaseFilePath,
  hashFile,
  loadConfig,
  loadOptionalAiConfig,
  loadOptionalFeishuConfig,
  loadProjectsIndex,
  readSummaryTemplate,
  syncRepositories,
  validateSummaryPeriod,
  writeGenerationInput,
  writeReport,
  writeTextAtomic,
} from "@weekly-git-report/core";
import {
  GenerationInputSchema,
  GENERATION_INPUT_FILE_NAME,
  ReportRunSchema,
  ReportTypeSchema,
} from "@weekly-git-report/shared";
import type {
  GenerationInput,
  Period,
  ReportCadence,
  ReportGenerator,
  ReportType,
  ReportRun,
  ReportRunError,
  ReportRunStep,
  ReportRunTrigger,
  ReportTask,
} from "@weekly-git-report/shared";

import { generateReportWithAi, redactSecrets } from "./ai.js";
import { publishSummaryToFeishu } from "./feishu.js";
import { createQueuedRun, ReportRunStore } from "./run-store.js";
import { saveSummary } from "./index.js";

const activeAbortControllers = new Map<string, AbortController>();

export interface PrepareReportRunInput {
  reportType: ReportType;
  templateType?: ReportType;
  reportId?: string;
  title?: string;
  period: Period;
  generator: ReportGenerator;
  trigger?: ReportRunTrigger;
  projectIds?: string[];
  author?: string[];
  userContext?: string;
  task?: ReportTask;
  onRunCreated?(runId: string): void;
}

export interface PreparedReportRun {
  run: ReportRun;
  generationInput: GenerationInput;
  generationInputFile: string;
  template: string;
}

export async function prepareReportRun(input: PrepareReportRunInput): Promise<PreparedReportRun> {
  const reportType = ReportTypeSchema.parse(input.reportType);
  const templateType = resolveTemplateType(reportType, input.templateType);
  const period = validateSummaryPeriod(reportType, input.period);
  const id = randomUUID();
  const reportId = input.reportId ?? id;
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  let run = store.create(
    createQueuedRun({
      id,
      reportId,
      reportType,
      templateType,
      ...(input.title?.trim() ? { title: input.title.trim() } : {}),
      period,
      generator: input.generator,
      trigger:
        input.trigger ?? (input.generator === "external-agent" ? "external-agent" : "manual"),
      ...(input.task ? { taskId: input.task.id, taskSnapshot: input.task } : {}),
    }),
  );
  input.onRunCreated?.(run.id);
  try {
    run = await waitForCollectionSlot(store, run);
    const config = await loadConfig();
    const projectsIndex = await loadProjectsIndex();
    const projects = selectProjects(
      projectsIndex.projects.filter((project) => project.enabled),
      input.projectIds ?? input.task?.projectIds ?? [],
    );
    const syncResult = await syncRepositories(projects);
    const collectResult = await collectCommits({
      projects: syncResult.projects,
      period,
      authorOverrides: input.author ?? [],
      identities: config.identities,
    });
    if (store.require(run.id).status === "cancelled") {
      throw new RunOperationError("RUN_CANCELLED", "Report run was cancelled.", "collect");
    }
    collectResult.errors.unshift(...syncResult.errors);
    const report = await writeReport({
      config,
      period,
      collectResult,
      backup: false,
    });
    if (report.errors.length > 0) {
      throw new RunOperationError(
        "COLLECT_FAILED",
        report.errors
          .map((error) => `${error.name ?? error.projectId ?? "unknown"}: ${error.message}`)
          .join("\n"),
        "collect",
      );
    }
    const template = await readSummaryTemplate({
      reportType: templateType,
      period,
      reportTitle: input.title,
    });
    const rawManifestHash = await hashFile(report.manifestFile);
    const generationInput = createGenerationInput({
      runId: run.id,
      reportId,
      reportType,
      templateType,
      ...(input.title ? { reportTitle: input.title } : {}),
      period,
      templateRevision: template.template.revision,
      rawManifestHash,
      collectResult,
      ...((input.userContext ?? input.task?.userContext)
        ? { userContext: input.userContext ?? input.task?.userContext }
        : {}),
    });
    const runDir = getRunDir(run.id);
    await mkdir(runDir, { recursive: true });
    const generationInputFile = path.join(runDir, GENERATION_INPUT_FILE_NAME);
    const writtenInput = await writeGenerationInput(generationInputFile, generationInput);
    run = transition(
      store,
      run,
      "generating",
      finishStep(run, "collect", "succeeded", {
        rawManifestPath: report.manifestFile,
        rawManifestHash,
        generationInputPath: generationInputFile,
        generationInputHash: writtenInput.hash,
        templateType,
        templateRevision: template.template.revision,
      }),
    );
    return {
      run,
      generationInput,
      generationInputFile,
      template: template.template.renderedContent ?? template.template.content,
    };
  } catch (error) {
    const current = store.require(run.id);
    if (current.status === "cancelled") throw error;
    const failure = normalizeRunError(error, "collect");
    run = transition(
      store,
      run,
      "failed",
      finishStep(run, "collect", "failed", { error: failure }),
    );
    throw error;
  } finally {
    store.close();
  }
}

export async function generateBuiltInRun(
  runId: string,
  options: {
    onTextDelta?(delta: string): void;
    autoSave?: boolean;
    publish?: boolean;
    allowEmpty?: boolean;
    restoreReviewOnFailure?: boolean;
  } = {},
): Promise<ReportRun> {
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  let run = store.require(runId);
  if (run.generator !== "builtin-ai" || run.status !== "generating") {
    store.close();
    throw new Error("This run is not ready for built-in AI generation.");
  }
  const controller = new AbortController();
  activeAbortControllers.set(runId, controller);
  try {
    run = store.replace({ ...run, ...startStep(run, "generate"), updatedAt: now() });
    const aiConfig = await loadOptionalAiConfig();
    if (!aiConfig)
      throw new RunOperationError("AI_NOT_CONFIGURED", "请先配置 AI 服务。", "generate");
    const generationInput = GenerationInputSchema.parse(
      JSON.parse(await readFile(required(run.generationInputPath), "utf8")),
    );
    if (
      !options.allowEmpty &&
      generationInput.repositories.every((repository) => repository.commits.length === 0)
    ) {
      throw new RunOperationError(
        "NO_COMMITS",
        "所选周期没有匹配的提交。请更换周期，或确认仍然生成空周期报告。",
        "generate",
      );
    }
    if ((await hashFile(required(run.generationInputPath))) !== run.generationInputHash) {
      throw new RunOperationError(
        "INPUT_CHANGED",
        "Generation input changed after preparation.",
        "generate",
      );
    }
    const template = await readSummaryTemplate({
      reportType: run.templateType ?? run.reportType,
      period: run.period,
      reportTitle: run.title,
    });
    if (template.template.revision !== run.templateRevision) {
      throw new RunOperationError(
        "TEMPLATE_CHANGED",
        "Summary template changed after preparation.",
        "generate",
      );
    }
    const result = await generateReportWithAi({
      config: aiConfig,
      template: template.template.renderedContent ?? template.template.content,
      input: generationInput,
      abortSignal: controller.signal,
      onTextDelta: options.onTextDelta,
    });
    const draftPath = path.join(getRunDir(run.id), "draft.md");
    await writeTextAtomic(draftPath, result.content);
    run = transition(
      store,
      run,
      options.autoSave ? "saving" : "awaiting_review",
      finishStep(run, "generate", "succeeded", {
        provider: result.provider,
        model: result.model,
        ...(result.tokenUsage ? { tokenUsage: result.tokenUsage } : {}),
        draftPath,
      }),
    );
    if (!options.autoSave) {
      run = store.replace({ ...run, ...startStep(run, "review"), updatedAt: now() });
    }
  } catch (error) {
    const aiConfig = await loadOptionalAiConfig();
    const message = redactSecrets(getMessage(error), [aiConfig?.apiKey]);
    const redactedError =
      error instanceof RunOperationError
        ? new RunOperationError(error.code, message, error.retryableFrom)
        : new Error(message);
    const failure = normalizeRunError(redactedError, "generate");
    const current = store.require(run.id);
    if (current.status === "cancelled") throw new Error(message, { cause: error });
    const generationStatus = controller.signal.aborted ? "cancelled" : "failed";
    run = transition(
      store,
      run,
      !controller.signal.aborted && options.restoreReviewOnFailure
        ? "awaiting_review"
        : generationStatus,
      {
        ...finishStep(run, "generate", generationStatus, { error: failure }),
        ...(!controller.signal.aborted && options.restoreReviewOnFailure
          ? { error: undefined, finishedAt: undefined }
          : {}),
      },
    );
    if (!controller.signal.aborted && options.restoreReviewOnFailure) {
      run = store.replace({ ...run, ...startStep(run, "review"), updatedAt: now() });
    }
    throw new Error(message, { cause: error });
  } finally {
    activeAbortControllers.delete(runId);
    store.close();
  }
  if (options.autoSave) {
    return approveReportRun(runId, undefined, { publish: options.publish });
  }
  return run;
}

export async function approveReportRun(
  runId: string,
  content?: string,
  options: { publish?: boolean; force?: boolean } = {},
): Promise<ReportRun> {
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  let run = store.require(runId);
  try {
    if (run.status === "awaiting_review") {
      const reviewed = store.replace({
        ...run,
        ...finishStep(run, "review", "succeeded"),
        updatedAt: now(),
      });
      run = transition(store, reviewed, "saving", startStep(reviewed, "save"));
    } else if (run.status !== "saving") {
      throw new Error("This run is not ready to save.");
    }
    const reportContent = content ?? (await readFile(required(run.draftPath), "utf8"));
    const preparedInput = GenerationInputSchema.parse(
      JSON.parse(await readFile(required(run.generationInputPath), "utf8")),
    );
    if (content !== undefined) await writeTextAtomic(required(run.draftPath), reportContent);
    const saved = await saveSummary({
      ...run.period,
      reportType: run.reportType,
      reportId: run.reportId,
      ...(run.title ? { title: run.title } : {}),
      content: reportContent,
      force: options.force ?? false,
      provenance: {
        reportId: run.reportId,
        runId: run.id,
        ...(run.taskId ? { taskId: run.taskId } : {}),
        generator: run.generator,
        ...(run.provider ? { provider: run.provider } : {}),
        ...(run.model ? { model: run.model } : {}),
        templateType: run.templateType ?? run.reportType,
        templateRevision: required(run.templateRevision),
        rawManifestHash: required(run.rawManifestHash),
        ...(preparedInput.userContext
          ? { userNotesHash: await hashText(preparedInput.userContext) }
          : {}),
      },
    });
    run = store.replace({
      ...run,
      ...finishStep(run, "save", "succeeded", { summaryPath: saved.summaryFile }),
      updatedAt: now(),
    });
    if (!options.publish) {
      return transition(store, run, "succeeded", { finishedAt: now() });
    }
    run = transition(store, run, "publishing", startStep(run, "publish"));
    const feishu = await loadOptionalFeishuConfig();
    if (!feishu?.testedAt) {
      throw new RunOperationError("FEISHU_NOT_TESTED", "飞书配置尚未测试成功。", "publish");
    }
    await publishSummaryToFeishu(feishu, saved.summaryFile);
    return transition(
      store,
      run,
      "succeeded",
      finishStep(run, "publish", "succeeded", { finishedAt: now() }),
    );
  } catch (error) {
    const current = store.require(runId);
    const feishu = current.status === "publishing" ? await loadOptionalFeishuConfig() : null;
    const safeError = new Error(
      redactSecrets(getMessage(error), [feishu?.webhookUrl, feishu?.signingSecret]),
    );
    const failure = normalizeRunError(
      safeError,
      current.status === "publishing" ? "publish" : "save",
    );
    if (current.status === "saving") {
      run = transition(
        store,
        current,
        "awaiting_review",
        finishStep(current, "save", "failed", { error: failure }),
      );
    } else if (current.status === "publishing") {
      run = transition(
        store,
        current,
        "publish_failed",
        finishStep(current, "publish", "failed", {
          error: failure,
          finishedAt: now(),
        }),
      );
    }
    throw safeError;
  } finally {
    store.close();
  }
}

export async function completeExternalRun(
  runId: string,
  content: string,
  options: { publish?: boolean; force?: boolean } = {},
): Promise<ReportRun> {
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  let run = store.require(runId);
  try {
    if (run.generator !== "external-agent" || run.status !== "generating") {
      throw new Error("This external Agent run is not awaiting completion.");
    }
    const draftPath = path.join(getRunDir(run.id), "draft.md");
    await writeTextAtomic(draftPath, content.endsWith("\n") ? content : `${content}\n`);
    run = transition(store, run, "saving", finishStep(run, "generate", "succeeded", { draftPath }));
  } finally {
    store.close();
  }
  return approveReportRun(runId, undefined, options);
}

export function listReportRuns(limit?: number): ReportRun[] {
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  try {
    return store.list(limit);
  } finally {
    store.close();
  }
}

export function getReportRun(runId: string): ReportRun {
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  try {
    return store.require(runId);
  } finally {
    store.close();
  }
}

export function getReportRunCounts() {
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  try {
    return store.countByStatus();
  } finally {
    store.close();
  }
}

export function cancelReportRun(runId: string): ReportRun {
  activeAbortControllers.get(runId)?.abort();
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  try {
    const run = store.require(runId);
    if (!["queued", "collecting", "generating", "awaiting_review"].includes(run.status)) {
      throw new Error("This run can no longer be cancelled.");
    }
    return transition(
      store,
      run,
      "cancelled",
      run.status === "awaiting_review"
        ? finishStep(run, "review", "cancelled", { finishedAt: now() })
        : { finishedAt: now() },
    );
  } finally {
    store.close();
  }
}

export async function retryReportRun(
  runId: string,
  options: { allowEmpty?: boolean } = {},
): Promise<ReportRun> {
  if (getReportRun(runId).status === "publish_failed") {
    return publishReportRun(runId);
  }
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  let run = store.require(runId);
  try {
    if (run.status !== "failed" || run.error?.retryableFrom !== "generate") {
      throw new Error("This run cannot be retried from its current failure.");
    }
    if ((await hashFile(required(run.generationInputPath))) !== run.generationInputHash) {
      throw new Error("Generation input changed; collect a new run instead.");
    }
    run = transition(store, { ...run, attempt: run.attempt + 1 }, "generating", {
      error: undefined,
      finishedAt: undefined,
    });
  } finally {
    store.close();
  }
  return generateBuiltInRun(runId, options);
}

export async function regenerateReportRun(
  runId: string,
  options: { onTextDelta?(delta: string): void } = {},
): Promise<ReportRun> {
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  let run = store.require(runId);
  try {
    if (run.generator !== "builtin-ai" || run.status !== "awaiting_review") {
      throw new Error("This run is not ready to regenerate.");
    }
    if ((await hashFile(required(run.generationInputPath))) !== run.generationInputHash) {
      throw new Error("Generation input changed; collect a new run instead.");
    }
    const reviewedRun = {
      ...run,
      ...finishStep(run, "review", "cancelled"),
      attempt: run.attempt + 1,
    };
    run = transition(store, reviewedRun, "generating", {
      error: undefined,
      finishedAt: undefined,
    });
  } finally {
    store.close();
  }
  return generateBuiltInRun(runId, { ...options, restoreReviewOnFailure: true });
}

export async function publishReportRun(runId: string): Promise<ReportRun> {
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  let run = store.require(runId);
  let feishu = await loadOptionalFeishuConfig();
  try {
    if (!feishu?.testedAt) {
      throw new Error("Feishu configuration must pass a connection test first.");
    }
    if (run.status !== "succeeded" && run.status !== "publish_failed") {
      throw new Error("This run does not have a saved report ready to publish.");
    }
    if (run.status === "publish_failed") run = { ...run, attempt: run.attempt + 1 };
    run = transition(store, { ...run, error: undefined, finishedAt: undefined }, "publishing", {
      ...startStep(run, "publish"),
      error: undefined,
      finishedAt: undefined,
    });
    await publishSummaryToFeishu(feishu, required(run.summaryPath));
    return transition(
      store,
      run,
      "succeeded",
      finishStep(run, "publish", "succeeded", { finishedAt: now() }),
    );
  } catch (error) {
    const safeError = new Error(
      redactSecrets(getMessage(error), [feishu?.webhookUrl, feishu?.signingSecret]),
    );
    const current = store.require(runId);
    if (current.status === "publishing") {
      transition(
        store,
        current,
        "publish_failed",
        finishStep(current, "publish", "failed", {
          error: normalizeRunError(safeError, "publish"),
          finishedAt: now(),
        }),
      );
    }
    throw safeError;
  } finally {
    feishu = null;
    store.close();
  }
}

export function failExternalRun(runId: string, message: string): ReportRun {
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  try {
    const run = store.require(runId);
    if (run.generator !== "external-agent" || run.status !== "generating") {
      throw new Error("This external Agent run is not awaiting completion.");
    }
    const error: ReportRunError = {
      code: "EXTERNAL_AGENT_FAILED",
      message,
      retryableFrom: "generate",
    };
    return transition(
      store,
      run,
      "failed",
      finishStep(run, "generate", "failed", { error, finishedAt: now() }),
    );
  } finally {
    store.close();
  }
}

export function resolvePreviousPeriod(
  cadence: ReportCadence,
  date = new Date(),
  includeWeekends = false,
): Period {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (cadence === "daily") {
    local.setDate(local.getDate() - 1);
    if (!includeWeekends) {
      while (local.getDay() === 0 || local.getDay() === 6) local.setDate(local.getDate() - 1);
    }
    const day = formatLocalDate(local);
    return { start: day, end: day };
  }
  if (cadence === "weekly") {
    const day = local.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    local.setDate(local.getDate() - daysSinceMonday - 7);
    const start = formatLocalDate(local);
    local.setDate(local.getDate() + 6);
    return { start, end: formatLocalDate(local) };
  }
  local.setDate(0);
  const end = formatLocalDate(local);
  local.setDate(1);
  return { start: formatLocalDate(local), end };
}

export function resolveCurrentPeriod(
  reportType: Exclude<ReportType, "custom">,
  date = new Date(),
): Period {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = formatLocalDate(local);
  if (reportType === "daily") return { start: end, end };
  if (reportType === "weekly") {
    const day = local.getDay();
    local.setDate(local.getDate() - (day === 0 ? 6 : day - 1));
    return { start: formatLocalDate(local), end };
  }
  local.setDate(1);
  return { start: formatLocalDate(local), end };
}

export function resolveScheduledTaskPeriod(
  cadence: ReportCadence,
  date = new Date(),
  includeWeekends = false,
): Period {
  return cadence === "daily"
    ? resolveCurrentPeriod("daily", date)
    : resolvePreviousPeriod(cadence, date, includeWeekends);
}

export async function maintainReportRuns(referenceDate = new Date()): Promise<void> {
  const store = new ReportRunStore(getRunsDatabaseFilePath());
  try {
    const abandonedBefore = referenceDate.getTime() - 24 * 60 * 60 * 1_000;
    const cleanupBefore = referenceDate.getTime() - 7 * 24 * 60 * 60 * 1_000;
    for (const run of store.list(1_000)) {
      if (
        run.generator === "external-agent" &&
        run.status === "generating" &&
        new Date(run.updatedAt).getTime() < abandonedBefore
      ) {
        transition(store, run, "abandoned", {
          error: {
            code: "EXTERNAL_AGENT_TIMEOUT",
            message: "External Agent did not complete within 24 hours.",
          },
          finishedAt: now(),
        });
        continue;
      }
      if (
        ["succeeded", "publish_failed", "failed", "cancelled", "abandoned"].includes(run.status) &&
        new Date(run.updatedAt).getTime() < cleanupBefore
      ) {
        await rm(getRunDir(run.id), { recursive: true, force: true });
      }
    }
  } finally {
    store.close();
  }
}

function transition(
  store: ReportRunStore,
  run: ReportRun,
  status: ReportRun["status"],
  patch: Partial<ReportRun> = {},
): ReportRun {
  return store.replace(ReportRunSchema.parse({ ...run, ...patch, status, updatedAt: now() }));
}

async function waitForCollectionSlot(
  store: ReportRunStore,
  queuedRun: ReportRun,
): Promise<ReportRun> {
  while (true) {
    const current = store.require(queuedRun.id);
    if (current.status === "cancelled") {
      throw new RunOperationError("RUN_CANCELLED", "Report run was cancelled.", "collect");
    }
    if (current.status !== "queued") {
      throw new Error(`Report run left the queue unexpectedly: ${current.status}.`);
    }
    const candidate = ReportRunSchema.parse({
      ...current,
      ...startStep(current, "collect"),
      status: "collecting",
      updatedAt: now(),
    });
    const claimed = store.tryReplaceActive(candidate);
    if (claimed) return claimed;
    await delay(250);
  }
}

function startStep(run: ReportRun, name: ReportRunStep["name"]): Partial<ReportRun> {
  return setStep(run, { name, attempt: run.attempt, status: "running", startedAt: now() });
}

function finishStep(
  run: ReportRun,
  name: ReportRunStep["name"],
  status: ReportRunStep["status"],
  patch: Partial<ReportRun> = {},
): Partial<ReportRun> {
  const existing = run.steps.find((step) => step.name === name && step.attempt === run.attempt);
  return {
    ...patch,
    ...setStep(run, {
      name,
      attempt: run.attempt,
      status,
      startedAt: existing?.startedAt ?? now(),
      finishedAt: now(),
      ...(patch.error ? { error: patch.error } : {}),
    }),
  };
}

function setStep(run: ReportRun, step: ReportRunStep): Partial<ReportRun> {
  return {
    steps: [
      ...run.steps.filter(
        (current) => current.name !== step.name || current.attempt !== step.attempt,
      ),
      step,
    ],
  };
}

function selectProjects<T extends { id: string; name: string }>(projects: T[], ids: string[]): T[] {
  if (ids.length === 0) return projects;
  const selected = new Set(ids);
  const matches = projects.filter(
    (project) => selected.has(project.id) || selected.has(project.name),
  );
  const found = new Set(matches.flatMap((project) => [project.id, project.name]));
  const unknown = ids.filter((id) => !found.has(id));
  if (unknown.length) throw new Error(`Unknown or disabled projects: ${unknown.join(", ")}`);
  return matches;
}

function resolveTemplateType(reportType: ReportType, input: ReportType | undefined): ReportType {
  const templateType = input === undefined ? reportType : ReportTypeSchema.parse(input);
  if (reportType !== "custom" && templateType !== reportType) {
    throw new Error("Only custom reports can use a different template type.");
  }
  return templateType;
}

function normalizeRunError(error: unknown, retryableFrom: ReportRunStep["name"]): ReportRunError {
  if (error instanceof RunOperationError) {
    return { code: error.code, message: error.message, retryableFrom: error.retryableFrom };
  }
  if (retryableFrom === "save" && isSummaryReplacementRequired(error)) {
    return {
      code: "SUMMARY_REPLACE_REQUIRED",
      message: "同周期已有无法安全替换的报告，请确认覆盖后重试。原文件会备份到 .history。",
      retryableFrom,
    };
  }
  return { code: "RUN_FAILED", message: getMessage(error), retryableFrom };
}

function isSummaryReplacementRequired(error: unknown): boolean {
  const message = getMessage(error);
  return (
    message.includes("Existing summary metadata is invalid") ||
    message.includes("Existing summary is ")
  );
}

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null || value === "")
    throw new Error("Run artifact is missing.");
  return value;
}

async function hashText(value: string): Promise<string> {
  const { sha256 } = await import("@weekly-git-report/core");
  return sha256(value);
}

function now(): string {
  return new Date().toISOString();
}

function formatLocalDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class RunOperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryableFrom: ReportRunStep["name"],
  ) {
    super(message);
    this.name = "RunOperationError";
  }
}
