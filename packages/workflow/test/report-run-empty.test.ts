import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { sha256 } from "@weekly-git-report/core";

import {
  createQueuedRun,
  generateBuiltInRun,
  prepareReportRun,
  regenerateReportRun,
  ReportRunStore,
} from "../src/index.js";

type GenerateReportWithAi = typeof import("../src/ai.js").generateReportWithAi;
type ReadSummaryTemplate = typeof import("@weekly-git-report/core").readSummaryTemplate;

const mocks = vi.hoisted(() => ({
  directory: "",
  generateReportWithAi: vi.fn<GenerateReportWithAi>(),
  readSummaryTemplate: vi.fn<ReadSummaryTemplate>(),
}));

vi.mock("@weekly-git-report/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@weekly-git-report/core")>();
  return {
    ...actual,
    getRunsDatabaseFilePath: () => path.join(mocks.directory, "runs.db"),
    getRunDir: (runId: string) => path.join(mocks.directory, "runs", runId),
    readSummaryTemplate: mocks.readSummaryTemplate,
    loadOptionalAiConfig: async () => ({
      version: 2,
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.4-mini",
      apiKey: "test-key",
      dataSharingAcceptedAt: "2026-08-29T00:00:00.000Z",
      testedAt: "2026-08-29T00:00:00.000Z",
    }),
  };
});

beforeEach(() => {
  mocks.readSummaryTemplate.mockImplementation(async (options = {}) => {
    const reportType = options.reportType ?? "weekly";
    return {
      formatVersion: 1,
      type: reportType,
      template: {
        content: `# ${reportType}`,
        renderedContent: `# rendered ${reportType}`,
        path: `templates/${reportType}/summary.md`,
        revision: "template-revision",
        defaultRevision: "template-revision",
        isDefault: true,
      },
      created: false,
    };
  });
});

vi.mock("../src/ai.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ai.js")>();
  return { ...actual, generateReportWithAi: mocks.generateReportWithAi };
});

afterEach(async () => {
  mocks.generateReportWithAi.mockReset();
  mocks.readSummaryTemplate.mockClear();
  if (mocks.directory) await rm(mocks.directory, { recursive: true, force: true });
  mocks.directory = "";
});

describe("empty report run", () => {
  test("rejects a different template type for fixed report periods", async () => {
    await expect(
      prepareReportRun({
        reportType: "weekly",
        templateType: "monthly",
        period: { start: "2026-08-17", end: "2026-08-23" },
        generator: "builtin-ai",
      }),
    ).rejects.toThrow("Only custom reports can use a different template type.");
  });

  test("stops before AI and preserves a retryable NO_COMMITS error", async () => {
    mocks.directory = await mkdtemp(path.join(os.tmpdir(), "weekly-empty-run-"));
    const runId = "run-empty";
    const generationInputPath = path.join(mocks.directory, "runs", runId, "input.json");
    await mkdir(path.dirname(generationInputPath), { recursive: true });
    await writeFile(
      generationInputPath,
      JSON.stringify({
        version: 2,
        runId,
        reportId: "report-empty",
        reportType: "weekly",
        period: { start: "2026-08-17", end: "2026-08-23" },
        createdAt: "2026-08-24T00:00:00.000Z",
        templateRevision: "template-revision",
        rawManifestHash: `sha256:${"a".repeat(64)}`,
        repositories: [{ id: "repo", name: "repo", branch: "main", commits: [] }],
      }),
      "utf8",
    );

    const store = new ReportRunStore(path.join(mocks.directory, "runs.db"));
    store.create({
      ...createQueuedRun({
        id: runId,
        reportId: "report-empty",
        reportType: "weekly",
        period: { start: "2026-08-17", end: "2026-08-23" },
        trigger: "manual",
        generator: "builtin-ai",
      }),
      status: "generating",
      generationInputPath,
      generationInputHash: `sha256:${"b".repeat(64)}`,
      templateRevision: "template-revision",
    });
    store.close();

    await expect(generateBuiltInRun(runId)).rejects.toThrow("没有匹配的提交");
    expect(mocks.generateReportWithAi).not.toHaveBeenCalled();

    const resultStore = new ReportRunStore(path.join(mocks.directory, "runs.db"));
    const failed = resultStore.require(runId);
    resultStore.close();
    expect(failed.status).toBe("failed");
    expect(failed.error).toEqual({
      code: "NO_COMMITS",
      message: "所选周期没有匹配的提交。请更换周期，或确认仍然生成空周期报告。",
      retryableFrom: "generate",
    });
  });

  test("uses the selected template type for a custom report run", async () => {
    mocks.directory = await mkdtemp(path.join(os.tmpdir(), "weekly-selected-template-run-"));
    const runId = "run-selected-template";
    const generationInputPath = path.join(mocks.directory, "runs", runId, "input.json");
    const generationInput = JSON.stringify({
      version: 2,
      runId,
      reportId: "report-custom",
      reportType: "custom",
      templateType: "weekly",
      reportTitle: "补生成报告",
      period: { start: "2026-08-17", end: "2026-08-23" },
      createdAt: "2026-08-24T00:00:00.000Z",
      templateRevision: "template-revision",
      rawManifestHash: `sha256:${"a".repeat(64)}`,
      repositories: [
        {
          id: "repo",
          name: "repo",
          branch: "main",
          commits: [
            {
              hash: "commit-1",
              committedAt: "2026-08-20T00:00:00.000Z",
              subject: "完成报告功能",
              body: "",
              authorName: "Alice",
            },
          ],
        },
      ],
    });
    await mkdir(path.dirname(generationInputPath), { recursive: true });
    await writeFile(generationInputPath, generationInput, "utf8");

    const store = new ReportRunStore(path.join(mocks.directory, "runs.db"));
    store.create({
      ...createQueuedRun({
        id: runId,
        reportId: "report-custom",
        reportType: "custom",
        templateType: "weekly",
        title: "补生成报告",
        period: { start: "2026-08-17", end: "2026-08-23" },
        trigger: "manual",
        generator: "builtin-ai",
      }),
      status: "generating",
      generationInputPath,
      generationInputHash: sha256(generationInput),
      templateType: "weekly",
      templateRevision: "template-revision",
    });
    store.close();
    mocks.generateReportWithAi.mockResolvedValue({
      content: "# 补生成报告\n",
      provider: "openai",
      model: "gpt-5.4-mini",
    });

    await expect(generateBuiltInRun(runId)).resolves.toMatchObject({
      reportType: "custom",
      templateType: "weekly",
      status: "awaiting_review",
    });
    expect(mocks.readSummaryTemplate).toHaveBeenCalledWith({
      reportType: "weekly",
      period: { start: "2026-08-17", end: "2026-08-23" },
      reportTitle: "补生成报告",
    });
    expect(mocks.generateReportWithAi).toHaveBeenCalledWith(
      expect.objectContaining({ template: "# rendered weekly" }),
    );
  });
});

describe("report draft regeneration", () => {
  test("reuses the prepared input and replaces the draft after successful generation", async () => {
    const prepared = await createAwaitingReviewRun("successful");
    mocks.generateReportWithAi.mockResolvedValue({
      content: "# 第二版草稿\n",
      provider: "openai",
      model: "gpt-5.4-mini",
    });

    const regenerated = await regenerateReportRun(prepared.runId);

    expect(regenerated).toMatchObject({ status: "awaiting_review", attempt: 2 });
    expect(await readFile(prepared.draftPath, "utf8")).toBe("# 第二版草稿\n");
    expect(mocks.generateReportWithAi).toHaveBeenCalledOnce();
    expect(regenerated.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "review", attempt: 1, status: "cancelled" }),
        expect.objectContaining({ name: "generate", attempt: 2, status: "succeeded" }),
        expect.objectContaining({ name: "review", attempt: 2, status: "running" }),
      ]),
    );
  });

  test("restores review state and preserves the previous draft after generation fails", async () => {
    const prepared = await createAwaitingReviewRun("failed");
    mocks.generateReportWithAi.mockRejectedValue(new Error("AI service unavailable"));

    await expect(regenerateReportRun(prepared.runId)).rejects.toThrow("AI service unavailable");

    const store = new ReportRunStore(path.join(mocks.directory, "runs.db"));
    const restored = store.require(prepared.runId);
    store.close();
    expect(restored).toMatchObject({ status: "awaiting_review", attempt: 2 });
    expect(restored.error).toBeUndefined();
    expect(await readFile(prepared.draftPath, "utf8")).toBe("# 第一版草稿\n");
    expect(restored.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "review", attempt: 1, status: "cancelled" }),
        expect.objectContaining({ name: "generate", attempt: 2, status: "failed" }),
        expect.objectContaining({ name: "review", attempt: 2, status: "running" }),
      ]),
    );
  });
});

async function createAwaitingReviewRun(suffix: string) {
  mocks.directory = await mkdtemp(path.join(os.tmpdir(), `weekly-regenerate-${suffix}-`));
  const runId = `run-regenerate-${suffix}`;
  const runDir = path.join(mocks.directory, "runs", runId);
  const generationInputPath = path.join(runDir, "input.json");
  const draftPath = path.join(runDir, "draft.md");
  const generationInput = JSON.stringify({
    version: 2,
    runId,
    reportId: `report-regenerate-${suffix}`,
    reportType: "weekly",
    period: { start: "2026-08-17", end: "2026-08-23" },
    createdAt: "2026-08-24T00:00:00.000Z",
    templateRevision: "template-revision",
    rawManifestHash: `sha256:${"a".repeat(64)}`,
    repositories: [
      {
        id: "repo",
        name: "repo",
        branch: "main",
        commits: [
          {
            hash: "commit-1",
            committedAt: "2026-08-20T00:00:00.000Z",
            subject: "完成报告功能",
            body: "",
            authorName: "Alice",
          },
        ],
      },
    ],
  });
  await mkdir(runDir, { recursive: true });
  await writeFile(generationInputPath, generationInput, "utf8");
  await writeFile(draftPath, "# 第一版草稿\n", "utf8");

  const store = new ReportRunStore(path.join(mocks.directory, "runs.db"));
  store.create({
    ...createQueuedRun({
      id: runId,
      reportId: `report-regenerate-${suffix}`,
      reportType: "weekly",
      period: { start: "2026-08-17", end: "2026-08-23" },
      trigger: "manual",
      generator: "builtin-ai",
    }),
    status: "awaiting_review",
    generationInputPath,
    generationInputHash: sha256(generationInput),
    templateRevision: "template-revision",
    draftPath,
    steps: [
      {
        name: "review",
        attempt: 1,
        status: "running",
        startedAt: "2026-08-24T00:01:00.000Z",
      },
    ],
  });
  store.close();
  return { runId, draftPath };
}
