import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { createQueuedRun, generateBuiltInRun, ReportRunStore } from "../src/index.js";

type GenerateReportWithAi = typeof import("../src/ai.js").generateReportWithAi;

const mocks = vi.hoisted(() => ({
  directory: "",
  generateReportWithAi: vi.fn<GenerateReportWithAi>(),
}));

vi.mock("@weekly-git-report/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@weekly-git-report/core")>();
  return {
    ...actual,
    getRunsDatabaseFilePath: () => path.join(mocks.directory, "runs.db"),
    getRunDir: (runId: string) => path.join(mocks.directory, "runs", runId),
    loadOptionalAiConfig: async () => ({
      version: 1,
      provider: "openai",
      apiKey: "test-key",
      dataSharingAcceptedAt: "2026-08-29T00:00:00.000Z",
      testedAt: "2026-08-29T00:00:00.000Z",
    }),
  };
});

vi.mock("../src/ai.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ai.js")>();
  return { ...actual, generateReportWithAi: mocks.generateReportWithAi };
});

afterEach(async () => {
  mocks.generateReportWithAi.mockReset();
  if (mocks.directory) await rm(mocks.directory, { recursive: true, force: true });
  mocks.directory = "";
});

describe("empty report run", () => {
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
});
