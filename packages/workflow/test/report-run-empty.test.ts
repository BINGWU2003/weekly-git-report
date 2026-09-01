import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { sha256 } from "@weekly-git-report/core";

import {
  createQueuedRun,
  generateBuiltInRun,
  prepareReportRun,
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
